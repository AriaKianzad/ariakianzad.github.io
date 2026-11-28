(() => {
  "use strict";

  const ELEMENT_BLOCKS = new Set(["P","DIV","H2","H3","H4","BLOCKQUOTE","PRE","UL","OL","TABLE","FIGURE","HR"]);
  const INLINE_MARKS = new Set(["strong","em","u","del"]);

  class BlogRichEditor {
    constructor(root, options = {}) {
      if (!(root instanceof HTMLElement)) throw new TypeError("BlogRichEditor needs an editable HTMLElement.");
      this.root = root;
      this.onChange = typeof options.onChange === "function" ? options.onChange : () => {};
      this.history = [];
      this.historyIndex = -1;
      this.lastTypingAt = 0;
      this.savedRange = null;
      this.suppressInput = false;
      this.destroyed = false;
      this.maxHistory = 120;

      this.handleInput = this.handleInput.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.captureSelection = this.captureSelection.bind(this);
      root.addEventListener("input", this.handleInput);
      root.addEventListener("keydown", this.handleKeydown);
      root.addEventListener("keyup", this.captureSelection);
      root.addEventListener("mouseup", this.captureSelection);
      root.addEventListener("focus", this.captureSelection);
      document.addEventListener("selectionchange", this.captureSelection);
      this.resetHistory();
    }

    snapshot() {
      const selection = window.getSelection();
      let savedSelection = null;
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        if (this.root.contains(range.startContainer) && this.root.contains(range.endContainer)) {
          savedSelection = {
            startPath: this.nodePath(range.startContainer),
            startOffset: range.startOffset,
            endPath: this.nodePath(range.endContainer),
            endOffset: range.endOffset
          };
        }
      }
      return { html: this.root.innerHTML, selection: savedSelection };
    }

    nodePath(node) {
      const path = [];
      while (node && node !== this.root) {
        const parent = node.parentNode;
        if (!parent) return null;
        path.unshift(Array.prototype.indexOf.call(parent.childNodes, node));
        node = parent;
      }
      return node === this.root ? path : null;
    }

    nodeFromPath(path) {
      if (!Array.isArray(path)) return null;
      let node = this.root;
      for (const index of path) {
        if (!node?.childNodes || index < 0 || index >= node.childNodes.length) return null;
        node = node.childNodes[index];
      }
      return node;
    }

    resetHistory() {
      this.history = [this.snapshot()];
      this.historyIndex = 0;
      this.lastTypingAt = 0;
      this.captureSelection();
    }

    commit(typing = false) {
      if (this.destroyed) return;
      const next = this.snapshot();
      const current = this.history[this.historyIndex];
      if (current && current.html === next.html) {
        this.history[this.historyIndex] = next;
        return;
      }

      const now = Date.now();
      if (typing && this.lastTypingAt && now - this.lastTypingAt < 850 && this.historyIndex === this.history.length - 1) {
        this.history[this.historyIndex] = next;
      } else {
        this.history.splice(this.historyIndex + 1);
        this.history.push(next);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.historyIndex = this.history.length - 1;
      }
      this.lastTypingAt = typing ? now : 0;
    }

    handleInput(event) {
      if (this.suppressInput) return;
      const inputType = String(event.inputType || "");
      const typing = /^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward|deleteByCut|insertFromPaste)$/.test(inputType);
      this.commit(typing);
      this.captureSelection();
    }

    dispatchInput() {
      this.suppressInput = true;
      this.root.dispatchEvent(new Event("input", { bubbles: true }));
      this.suppressInput = false;
      this.captureSelection();
    }

    restore(snapshot) {
      if (!snapshot) return;
      this.root.innerHTML = snapshot.html;
      const saved = snapshot.selection;
      const start = saved ? this.nodeFromPath(saved.startPath) : null;
      const end = saved ? this.nodeFromPath(saved.endPath) : null;
      if (start && end) {
        const range = document.createRange();
        range.setStart(start, Math.min(saved.startOffset, start.nodeType === Node.TEXT_NODE ? start.nodeValue.length : start.childNodes.length));
        range.setEnd(end, Math.min(saved.endOffset, end.nodeType === Node.TEXT_NODE ? end.nodeValue.length : end.childNodes.length));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        this.placeCaretAtEnd();
      }
      this.dispatchInput();
    }

    undo() {
      if (this.historyIndex <= 0) return false;
      this.historyIndex -= 1;
      this.lastTypingAt = 0;
      this.restore(this.history[this.historyIndex]);
      return true;
    }

    redo() {
      if (this.historyIndex >= this.history.length - 1) return false;
      this.historyIndex += 1;
      this.lastTypingAt = 0;
      this.restore(this.history[this.historyIndex]);
      return true;
    }

    canUndo() { return this.historyIndex > 0; }
    canRedo() { return this.historyIndex < this.history.length - 1; }

    setContent(html) {
      this.root.innerHTML = String(html || "");
      this.resetHistory();
    }

    captureSelection() {
      if (this.destroyed) return;
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (this.root.contains(range.startContainer) && this.root.contains(range.endContainer)) {
        this.savedRange = range.cloneRange();
      }
    }

    restoreSelection() {
      const selection = window.getSelection();
      if (!selection) return null;
      if (this.savedRange && this.root.contains(this.savedRange.startContainer) && this.root.contains(this.savedRange.endContainer)) {
        selection.removeAllRanges();
        selection.addRange(this.savedRange);
      }
      if (!selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      return this.root.contains(range.startContainer) ? range : null;
    }

    placeCaretAfter(node) {
      const range = document.createRange();
      range.setStartAfter(node);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      this.savedRange = range.cloneRange();
    }

    placeCaretAtEnd() {
      this.root.focus();
      const range = document.createRange();
      range.selectNodeContents(this.root);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      this.savedRange = range.cloneRange();
    }

    currentElement() {
      const range = this.restoreSelection();
      if (!range) return null;
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      return node instanceof Element ? node : null;
    }

    closestBlock(node) {
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!(node instanceof Element)) return null;
      const block = node.closest("p,div,h2,h3,h4,blockquote,pre,li,ul,ol,table,figure,hr");
      return block && this.root.contains(block) ? block : null;
    }

    selectedTopLevelBlocks(range) {
      const directChild = (node) => {
        while (node && node.parentNode !== this.root) node = node.parentNode;
        return node?.parentNode === this.root ? node : null;
      };
      const start = directChild(range.startContainer);
      const end = directChild(range.endContainer);
      const children = Array.from(this.root.childNodes);
      const startIndex = start ? children.indexOf(start) : -1;
      const endIndex = end ? children.indexOf(end) : -1;
      if (startIndex < 0 || endIndex < 0) {
        const block = this.closestBlock(range.startContainer);
        return block ? [block] : [];
      }
      const from = Math.min(startIndex, endIndex);
      const to = Math.max(startIndex, endIndex);
      return children.slice(from, to + 1).filter((node) =>
        node.nodeType === Node.ELEMENT_NODE && ELEMENT_BLOCKS.has(node.tagName)
      );
    }

    formatBlock(tagName) {
      const tag = String(tagName || "").toUpperCase();
      if (!["P","H2","H3","H4","BLOCKQUOTE"].includes(tag)) return false;
      const range = this.restoreSelection() || (() => {
        const next = document.createRange();
        next.selectNodeContents(this.root);
        next.collapse(false);
        return next;
      })();
      const active = this.closestBlock(range.startContainer);
      if (tag === "BLOCKQUOTE") {
        const existing = active?.closest("blockquote");
        if (existing && this.root.contains(existing)) {
          const fragment = document.createDocumentFragment();
          while (existing.firstChild) {
            const child = existing.firstChild;
            if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) {
              existing.removeChild(child);
            } else if (child.nodeType === Node.ELEMENT_NODE && ["P","DIV"].includes(child.tagName)) {
              fragment.appendChild(child);
            } else {
              const paragraph = document.createElement("p");
              paragraph.appendChild(child);
              fragment.appendChild(paragraph);
            }
          }
          existing.replaceWith(fragment);
        } else {
          const blocks = this.selectedTopLevelBlocks(range);
          const target = blocks.length ? blocks : (active ? [active] : []);
          if (!target.length) return false;
          const quote = document.createElement("blockquote");
          target[0].before(quote);
          target.forEach((block) => quote.appendChild(block));
        }
      } else {
        const blocks = this.selectedTopLevelBlocks(range);
        const target = blocks.length ? blocks : (active ? [active] : []);
        if (!target.length) {
          const paragraph = document.createElement(tag.toLowerCase());
          paragraph.appendChild(document.createElement("br"));
          this.root.appendChild(paragraph);
          this.placeCaretAtEnd();
          this.commit(false);
          this.dispatchInput();
          return true;
        }
        const allActive = target.every((block) => block.tagName === tag);
        target.forEach((block) => {
          const listItem = block.closest("li");
          const source = listItem && this.root.contains(listItem)
            ? (block.matches("p,h2,h3,h4") ? block : listItem.querySelector(":scope > p,:scope > h2,:scope > h3,:scope > h4"))
            : block;
          if (!source || !source.matches("p,h2,h3,h4,div")) return;
          const replacement = document.createElement(allActive ? "p" : tag.toLowerCase());
          while (source.firstChild) replacement.appendChild(source.firstChild);
          if (!replacement.childNodes.length) replacement.appendChild(document.createElement("br"));
          source.replaceWith(replacement);
        });
      }
      this.commit(false);
      this.dispatchInput();
      return true;
    }

    toggleMark(tagName) {
      const tag = String(tagName || "").toLowerCase();
      if (!INLINE_MARKS.has(tag)) return false;
      const range = this.restoreSelection();
      if (!range) return false;
      const element = this.currentElement();
      const existing = element?.closest(tag);
      if (existing && this.root.contains(existing) && !range.collapsed && existing.contains(range.startContainer) && existing.contains(range.endContainer)) {
        const fragment = document.createDocumentFragment();
        while (existing.firstChild) fragment.appendChild(existing.firstChild);
        existing.replaceWith(fragment);
      } else if (range.collapsed) {
        const wrapper = document.createElement(tag);
        const marker = document.createTextNode("\u200b");
        wrapper.appendChild(marker);
        range.insertNode(wrapper);
        const next = document.createRange();
        next.setStart(marker, 1);
        next.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(next);
        this.savedRange = next.cloneRange();
      } else {
        const fragment = range.extractContents();
        const wrapper = document.createElement(tag);
        wrapper.appendChild(fragment);
        range.insertNode(wrapper);
        this.placeCaretAfter(wrapper);
      }
      this.commit(false);
      this.dispatchInput();
      return true;
    }

    toggleList(tagName) {
      const tag = String(tagName || "").toUpperCase();
      if (tag !== "UL" && tag !== "OL") return false;
      const range = this.restoreSelection();
      if (!range) return false;
      const active = this.closestBlock(range.startContainer);
      const list = active?.closest("ul,ol");
      if (list && this.root.contains(list)) {
        if (list.tagName === tag) {
          const fragment = document.createDocumentFragment();
          Array.from(list.children).filter((item) => item.tagName === "LI").forEach((item) => {
            const paragraph = document.createElement("p");
            const nested = [];
            Array.from(item.childNodes).forEach((child) => {
              if (child.nodeType === Node.ELEMENT_NODE && ["UL","OL"].includes(child.tagName)) nested.push(child);
              else paragraph.appendChild(child);
            });
            if (!paragraph.childNodes.length) paragraph.appendChild(document.createElement("br"));
            fragment.appendChild(paragraph);
            nested.forEach((child) => fragment.appendChild(child));
          });
          list.replaceWith(fragment);
        } else {
          const replacement = document.createElement(tag.toLowerCase());
          while (list.firstChild) replacement.appendChild(list.firstChild);
          list.replaceWith(replacement);
        }
      } else {
        const blocks = this.selectedTopLevelBlocks(range);
        const targets = blocks.filter((block) => block !== list);
        if (!targets.length) return false;
        const newList = document.createElement(tag.toLowerCase());
        targets[0].before(newList);
        targets.forEach((block) => {
          const item = document.createElement("li");
          if (block.tagName === "P" || block.tagName === "DIV" || /^H[2-4]$/.test(block.tagName)) {
            item.appendChild(block);
          } else {
            const paragraph = document.createElement("p");
            while (block.firstChild) paragraph.appendChild(block.firstChild);
            item.appendChild(paragraph);
            block.remove();
          }
          newList.appendChild(item);
        });
      }
      this.commit(false);
      this.dispatchInput();
      return true;
    }

    toggleCodeBlock() {
      const block = this.closestBlock(this.restoreSelection()?.startContainer);
      if (!block) return false;
      if (block.tagName === "PRE") {
        const paragraph = document.createElement("p");
        paragraph.textContent = block.textContent || "";
        block.replaceWith(paragraph);
      } else {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = block.textContent || "";
        pre.appendChild(code);
        block.replaceWith(pre);
      }
      this.commit(false);
      this.dispatchInput();
      return true;
    }

    insertHTML(html) {
      const range = this.restoreSelection() || document.createRange();
      if (!range.startContainer) {
        range.selectNodeContents(this.root);
        range.collapse(false);
      }
      range.deleteContents();
      const template = document.createElement("template");
      template.innerHTML = String(html || "");
      const fragment = template.content;
      const last = fragment.lastChild;
      range.insertNode(fragment);
      if (last) this.placeCaretAfter(last);
      this.root.focus();
      this.commit(false);
      this.dispatchInput();
    }

    wrapSelection(tagName, attributes = {}) {
      const tag = String(tagName || "").toLowerCase();
      if (!["a","strong","em","u","del"].includes(tag)) return false;
      const range = this.restoreSelection();
      if (!range) return false;
      if (range.collapsed) return false;
      const wrapper = document.createElement(tag);
      for (const [name,value] of Object.entries(attributes)) {
        if (name === "href") wrapper.setAttribute(name, String(value));
        else if (["target","rel","title"].includes(name)) wrapper.setAttribute(name, String(value));
        else if (name === "data-link-rel" || name === "data-link-target") wrapper.setAttribute(name, String(value));
      }
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
      this.placeCaretAfter(wrapper);
      this.commit(false);
      this.dispatchInput();
      return true;
    }

    insertHorizontalRule() {
      const range = this.restoreSelection();
      const block = range ? this.closestBlock(range.startContainer) : null;
      const rule = document.createElement("hr");
      if (block && block.parentNode) block.after(rule);
      else this.root.appendChild(rule);
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      rule.after(paragraph);
      this.placeCaretAtEndOf(paragraph);
      this.commit(false);
      this.dispatchInput();
    }

    placeCaretAtEndOf(element) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      this.savedRange = range.cloneRange();
      this.root.focus();
    }

    insertTable(rows = 3, columns = 3) {
      const rowCount = Math.max(2, Math.min(10, Number(rows) || 3));
      const columnCount = Math.max(2, Math.min(8, Number(columns) || 3));
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const headerRow = document.createElement("tr");
      for (let column = 0; column < columnCount; column += 1) {
        const cell = document.createElement("th");
        cell.textContent = "عنوان";
        headerRow.appendChild(cell);
      }
      head.appendChild(headerRow);
      const body = document.createElement("tbody");
      for (let row = 1; row < rowCount; row += 1) {
        const tr = document.createElement("tr");
        for (let column = 0; column < columnCount; column += 1) {
          const cell = document.createElement("td");
          cell.appendChild(document.createElement("br"));
          tr.appendChild(cell);
        }
        body.appendChild(tr);
      }
      table.append(head, body);
      this.insertHTML(table.outerHTML);
      const firstCell = this.root.querySelector("table:last-of-type th");
      if (firstCell) this.placeCaretAtEndOf(firstCell);
    }

    isActive(command, value = "") {
      const element = this.currentElement();
      const block = this.closestBlock(element);
      if (command === "bold") return Boolean(element?.closest("strong,b"));
      if (command === "italic") return Boolean(element?.closest("em,i"));
      if (command === "underline") return Boolean(element?.closest("u"));
      if (command === "strike") return Boolean(element?.closest("del,s,strike"));
      if (command === "insertUnorderedList") return Boolean(element?.closest("ul"));
      if (command === "insertOrderedList") return Boolean(element?.closest("ol"));
      if (command === "formatBlock") return value.toLowerCase() === "blockquote"
        ? Boolean(element?.closest("blockquote"))
        : block?.tagName?.toLowerCase() === value.toLowerCase();
      return false;
    }

    moveTableCell(direction) {
      const element = this.currentElement();
      const cell = element?.closest("td,th");
      const table = cell?.closest("table");
      if (!cell || !table || !this.root.contains(table)) return false;
      const cells = Array.from(table.querySelectorAll("th,td"));
      const index = cells.indexOf(cell);
      if (direction > 0 && index === cells.length - 1) {
        const body = table.tBodies[0] || table.appendChild(document.createElement("tbody"));
        const row = body.insertRow();
        for (let i = 0; i < table.rows[0].cells.length; i += 1) {
          const nextCell = row.insertCell();
          nextCell.appendChild(document.createElement("br"));
        }
        this.placeCaretAtEndOf(row.cells[0]);
        this.commit(false);
        this.dispatchInput();
        return true;
      }
      const next = cells[index + direction];
      if (!next) return false;
      this.placeCaretAtEndOf(next);
      return true;
    }

    handleKeydown(event) {
      const mod = event.ctrlKey || event.metaKey;
      const key = String(event.key || "").toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        this.redo();
        return;
      }
      if (mod && key === "b") { event.preventDefault(); this.toggleMark("strong"); return; }
      if (mod && key === "i") { event.preventDefault(); this.toggleMark("em"); return; }
      if (mod && key === "u") { event.preventDefault(); this.toggleMark("u"); return; }
      if (event.altKey && event.shiftKey && ["2","3","4"].includes(key)) {
        event.preventDefault();
        this.formatBlock("H" + key);
        return;
      }
      if (event.key === "Tab" && this.moveTableCell(event.shiftKey ? -1 : 1)) event.preventDefault();
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.root.removeEventListener("input", this.handleInput);
      this.root.removeEventListener("keydown", this.handleKeydown);
      this.root.removeEventListener("keyup", this.captureSelection);
      this.root.removeEventListener("mouseup", this.captureSelection);
      this.root.removeEventListener("focus", this.captureSelection);
      document.removeEventListener("selectionchange", this.captureSelection);
    }
  }

  window.BlogRichEditor = BlogRichEditor;
})();