import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [
  editorCore, editorApp, editorHtml, editorCss, adminEdge, fetchBlog,
  sitemap, rss, workflow, adminPage
] = await Promise.all([
  read("public/admin/blog/editor-core.js"),
  read("public/admin/blog/app.js"),
  read("public/admin/blog/index.html"),
  read("public/admin/blog/blog.css"),
  read("supabase/functions/blog-admin/index.ts"),
  read("scripts/fetch-blog-content.mjs"),
  read("src/app/sitemap.ts"),
  read("src/app/blog/feed.xml/route.ts"),
  read(".github/workflows/deploy.yml"),
  read("public/admin/index.html"),
]);

const coreScriptIndex = editorHtml.indexOf("editor-core.js");
const appScriptIndex = editorHtml.indexOf("./app.js");
assert.ok(coreScriptIndex >= 0 && appScriptIndex > coreScriptIndex,
  "the editor engine must load before the CMS application");
assert.ok(editorHtml.includes('role="toolbar"') && editorHtml.includes('aria-label="ابزارهای ویرایش متن"'),
  "the formatting controls must expose a named accessible toolbar");
assert.ok(editorHtml.includes('data-command="undo"') && editorHtml.includes('data-command="redo"'),
  "undo and redo controls must be available");
for (const command of [
  "formatBlock", "bold", "italic", "underline", "strike",
  "insertUnorderedList", "insertOrderedList", "insertCodeBlock",
  "insertTable", "insertHorizontalRule"
]) {
  assert.ok(editorHtml.includes('data-command="' + command + '"'),
    "the editor toolbar must expose " + command);
}
assert.ok(editorHtml.includes('id="editor-save-status"') && editorHtml.includes('id="editor-word-count"'),
  "the editing surface must expose autosave and word-count feedback");
assert.ok(editorHtml.includes('name="robots" content="noindex, nofollow, noarchive"'),
  "the CMS must remain noindex");

assert.ok(editorCore.includes("class BlogRichEditor") &&
  editorCore.includes("snapshot()") &&
  editorCore.includes("nodePath(node)") &&
  editorCore.includes("undo()") &&
  editorCore.includes("redo()") &&
  editorCore.includes("maxHistory = 120"),
  "the editor must maintain bounded history snapshots and restore selections");
assert.ok(editorCore.includes("event.ctrlKey || event.metaKey") &&
  editorCore.includes('this.toggleMark("strong")') &&
  editorCore.includes('this.toggleMark("em")') &&
  editorCore.includes('this.toggleMark("u")'),
  "the editor must support standard keyboard formatting shortcuts");
assert.ok(editorCore.includes("moveTableCell") &&
  editorCore.includes("insertTable(rows = 3, columns = 3)") &&
  editorCore.includes("toggleCodeBlock()"),
  "table navigation, table insertion and code blocks must be handled by the editor core");
assert.ok(!editorApp.includes("document.execCommand") &&
  !editorApp.includes("document.queryCommandState"),
  "the CMS must not depend on deprecated browser editing commands");
assert.ok(editorApp.includes("state.richEditor=new window.BlogRichEditor") &&
  editorApp.includes("state.richEditor.setContent(editorHtml)"),
  "the editor engine must be used for both initialisation and article hydration");
assert.ok(editorApp.includes("sanitizeClipboardHtml(html)") &&
  editorApp.includes('["script","style","iframe","object","embed","svg","meta","link"]'),
  "pasted HTML must be sanitized before insertion");
assert.ok(editorApp.includes("state.richEditor.insertHTML(html)"),
  "safe HTML insertion must pass through the editor engine");
assert.ok(editorApp.includes("function scheduleAutoSave()") &&
  editorApp.includes("window.setTimeout(()=>void autoSavePost(),3200)") &&
  editorApp.includes("if(!post.title.trim()||!post.slug.trim()||!post.content.trim())"),
  "autosave must be debounced and wait until title, slug and content are present");
assert.ok(editorApp.includes("savePost({silent:true,autosave:true})") &&
  editorApp.includes("state.editorChangeVersion===submittedVersion"),
  "autosave must use the existing server save endpoint and avoid clearing newer edits");
assert.ok(editorApp.includes('case "undo": editor.undo()') &&
  editorApp.includes('case "redo": editor.redo()') &&
  editorApp.includes('editor.toggleList("OL")'),
  "toolbar actions must be delegated to the editor engine");
assert.ok(editorApp.includes("function updatePreview()") &&
  editorApp.includes("editorToMarkdown($("# + '"post-content"' + ")"),
  "the existing Markdown publishing pipeline and preview must remain connected");
assert.ok(editorCss.includes(".editor-save-status[data-state=\"saved\"]") &&
  editorCss.includes(".editor-save-status[data-state=\"saving\"]") &&
  editorCss.includes(".editor-save-status[data-state=\"error\"]"),
  "autosave states must be visually distinguishable");
assert.ok(editorCss.includes("@media(max-width:560px)") &&
  editorCss.includes(".editor-richtext{min-height:420px"),
  "the editor must remain usable on narrow screens");
assert.ok(adminPage.includes("script-src 'self'") && !adminPage.includes("script-src 'self' 'unsafe-inline'"),
  "the admin content security policy must continue to prohibit inline script execution");

assert.ok(adminEdge.includes('await dispatchAfterWrite("publish_post")') &&
  adminEdge.includes('await dispatchAfterWrite(action)') &&
  adminEdge.includes('await dispatchAfterWrite("save_ad_banners")') &&
  adminEdge.includes('if (tokenConfigured) await dispatchAfterWrite("save_settings")'),
  "publishing, unpublishing, ad-slot updates and settings/category changes must dispatch a public rebuild");
assert.ok(adminEdge.includes('"/actions/workflows/deploy.yml/dispatches"') &&
  adminEdge.includes('body: JSON.stringify({ ref: "main" })'),
  "CMS publication must dispatch the main-branch build workflow");
assert.ok(workflow.includes("workflow_dispatch:") &&
  workflow.includes("npm run test:editor"),
  "the deployment workflow must support CMS dispatch and run editor regression tests");
assert.ok(workflow.includes("test -s out/admin/blog/editor-core.js") &&
  workflow.includes("find scripts public -type f") && workflow.includes("node --check"),
  "the deployment artifact must include a syntactically valid editor engine");
assert.ok(fetchBlog.includes("get_public_blog_payload") &&
  sitemap.includes("getBlogCategories()") &&
  sitemap.includes("getBlogPosts()") &&
  rss.includes("getBlogPosts()"),
  "the rebuilt sitemap and RSS must be generated from the latest published blog payload");

console.log("Blog editor contract tests passed.");
