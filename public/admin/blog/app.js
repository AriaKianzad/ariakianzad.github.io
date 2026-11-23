(() => {
  "use strict";
  const config = window.MIAN_E_MA_DASHBOARD_CONFIG || {};
  const supabaseUrl = typeof config.supabaseUrl === "string" ? config.supabaseUrl.replace(/\/+$/,"") : "";
  const anonKey = typeof config.supabaseAnonKey === "string" ? config.supabaseAnonKey : "";
  const $ = (selector) => document.querySelector(selector);
  const state = { accessToken:"", refreshToken:"", posts:[], currentPost:null, settings:null, busy:false, preview:false };
  const statusLabels = { draft:"پیش‌نویس", published:"منتشرشده", archived:"بایگانی" };
  const validConfig = supabaseUrl === "https://bkohdqwecnvbmeaiuyyx.supabase.co" && anonKey.startsWith("sb_publishable_");

  function toast(message, error) {
    const box=$("#toast");
    box.textContent=message;
    box.className="toast"+(error?" error":"");
    box.hidden=false;
    window.clearTimeout(toast.timer);
    toast.timer=window.setTimeout(()=>{box.hidden=true;},4600);
  }
  function setButton(button,busy,label) {
    if(!button)return;
    button.disabled=Boolean(busy);
    if(label)button.dataset.idleLabel=button.dataset.idleLabel||button.textContent;
    if(busy&&label)button.textContent=label;
    if(!busy&&button.dataset.idleLabel){button.textContent=button.dataset.idleLabel;delete button.dataset.idleLabel;}
  }
  async function parseResponse(response) {
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error_description||payload.msg||payload.error||"درخواست ناموفق بود.");
    return payload;
  }
  async function signIn(email,password) {
    const response=await fetch(supabaseUrl+"/auth/v1/token?grant_type=password",{
      method:"POST",headers:{apikey:anonKey,"Content-Type":"application/json"},
      body:JSON.stringify({email,password})
    });
    const payload=await parseResponse(response);
    if(!payload.access_token||!payload.refresh_token)throw new Error("پاسخ ورود کامل نیست.");
    state.accessToken=payload.access_token;
    state.refreshToken=payload.refresh_token;
  }
  async function refreshSession() {
    if(!state.refreshToken)return false;
    const response=await fetch(supabaseUrl+"/auth/v1/token?grant_type=refresh_token",{
      method:"POST",headers:{apikey:anonKey,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:state.refreshToken})
    });
    if(!response.ok)return false;
    const payload=await response.json().catch(()=>({}));
    if(!payload.access_token)return false;
    state.accessToken=payload.access_token;
    state.refreshToken=payload.refresh_token||state.refreshToken;
    return true;
  }
  async function api(action,data,retried) {
    const response=await fetch(supabaseUrl+"/functions/v1/blog-admin",{
      method:"POST",
      headers:{apikey:anonKey,Authorization:"Bearer "+state.accessToken,"Content-Type":"application/json"},
      body:JSON.stringify({action,...(data||{})})
    });
    if(response.status===401&&!retried&&await refreshSession())return api(action,data,true);
    if(response.status===401){logout(false);throw new Error("نشست ورود معتبر نیست. دوباره وارد شو.");}
    return parseResponse(response);
  }
  async function uploadRequest(form,retried) {
    const response=await fetch(supabaseUrl+"/functions/v1/blog-admin",{
      method:"POST",headers:{apikey:anonKey,Authorization:"Bearer "+state.accessToken},body:form
    });
    if(response.status===401&&!retried&&await refreshSession())return uploadRequest(form,true);
    if(response.status===401){logout(false);throw new Error("نشست ورود معتبر نیست. دوباره وارد شو.");}
    return parseResponse(response);
  }
  function showLogin(message) {
    $("#app").hidden=true;
    $("#login-screen").hidden=false;
    if(message)$("#login-message").textContent=message;
  }
  function showApp() {
    $("#login-screen").hidden=true;
    $("#app").hidden=false;
    $("#admin-email").textContent=window.blogAdminEmail||"مدیر";
  }
  async function logout(revoke) {
    const token=state.accessToken;
    state.accessToken="";state.refreshToken="";state.posts=[];state.currentPost=null;state.settings=null;
    if(revoke!==false&&token&&validConfig){
      fetch(supabaseUrl+"/auth/v1/logout?scope=local",{method:"POST",headers:{apikey:anonKey,Authorization:"Bearer "+token}}).catch(()=>{});
    }
    showLogin("از حساب خارج شدی.");
  }
  function dateLabel(value) {
    if(!value)return "—";
    return new Intl.DateTimeFormat("fa-IR",{year:"numeric",month:"short",day:"numeric"}).format(new Date(value));
  }
  function statusBadge(post) {
    const span=document.createElement("span");
    span.className="status-badge "+(post.status||"draft");
    span.textContent=statusLabels[post.status]||"نامشخص";
    return span;
  }
  function createPostRow(post) {
    const row=document.createElement("article");row.className="post-row";
    const main=document.createElement("div");main.className="post-row-main";
    const title=document.createElement("a");title.className="post-row-title";title.href="#";title.textContent=post.title||"بدون عنوان";
    title.addEventListener("click",(event)=>{event.preventDefault();void editPost(post.id);});
    const sub=document.createElement("div");sub.className="post-row-sub";
    [post.category||"بدون دسته‌بندی",dateLabel(post.updated_at)," / "+(post.slug||"بدون نامک")].forEach((value)=>{const span=document.createElement("span");span.textContent=value;sub.appendChild(span);});
    main.append(title,sub);
    const actions=document.createElement("div");actions.className="post-row-actions";
    actions.appendChild(statusBadge(post));
    if(post.has_unpublished_changes){const changed=document.createElement("span");changed.className="status-badge changed";changed.textContent="تغییر ذخیره‌شده";actions.appendChild(changed);}
    const edit=document.createElement("button");edit.type="button";edit.textContent="ویرایش";edit.addEventListener("click",()=>void editPost(post.id));
    actions.appendChild(edit);row.append(main,actions);return row;
  }
  async function loadPosts() {
    const result=await api("list_posts");
    state.posts=Array.isArray(result.posts)?result.posts:[];
    $("#nav-post-count").textContent=Number(state.posts.length).toLocaleString("fa-IR");
    renderOverview();renderPosts();
  }
  function renderOverview() {
    const posts=state.posts;
    $("#stat-total").textContent=posts.length.toLocaleString("fa-IR");
    $("#stat-published").textContent=posts.filter((p)=>p.status==="published").length.toLocaleString("fa-IR");
    $("#stat-drafts").textContent=posts.filter((p)=>p.status==="draft").length.toLocaleString("fa-IR");
    $("#stat-changes").textContent=posts.filter((p)=>p.has_unpublished_changes).length.toLocaleString("fa-IR");
    const list=$("#recent-posts");list.replaceChildren();
    posts.slice(0,6).forEach((post)=>list.appendChild(createPostRow(post)));
    if(!posts.length){const empty=document.createElement("p");empty.className="empty-state";empty.textContent="هنوز مقاله‌ای نساختی. اولین نوشته رو شروع کن.";list.appendChild(empty);}
  }
  function renderPosts() {
    if(!$("#posts-grid"))return;
    const needle=($("#posts-search").value||"").trim().toLocaleLowerCase();
    const filter=$("#posts-filter").value;
    const posts=state.posts.filter((post)=>(filter==="all"||post.status===filter)&&
      (!needle||[post.title,post.slug,post.category].join(" ").toLocaleLowerCase().includes(needle)));
    const grid=$("#posts-grid");grid.replaceChildren();
    posts.forEach((post)=>grid.appendChild(createPostRow(post)));
    $("#posts-empty").hidden=posts.length>0;
  }
  const newPost=()=>({
    id:"",slug:"",title:"",excerpt:"",content:"",language:"fa",category:"",tags:[],
    hero_image_url:"",hero_image_alt:"",hero_image_caption:"",og_image_url:"",
    seo_title:"",meta_description:"",focus_keyword:"",canonical_url:"",og_title:"",og_description:"",
    robots_index:true,robots_follow:true,featured:false,toc_enabled:true,drop_cap:false,
    content_width:"reading",accent_color:"#a86f54",faqs:[],status:"draft",has_unpublished_changes:false,
  });
  function showEditor(post) {
    state.currentPost={...newPost(),...(post||{})};
    state.preview=false;$("#editor-form").reset();fillEditor(state.currentPost);
    showView("editor");updatePreview();updateSeo();updateEditorStatus();
    $("#markdown-preview").hidden=true;$("#post-content").hidden=false;
    $("#link-settings").hidden=true;refreshLinkManager();
    document.querySelectorAll(".editor-tab").forEach((b)=>b.classList.toggle("active",b.dataset.tab==="seo"));
    document.querySelectorAll(".tab-panel").forEach((p)=>{p.hidden=p.id!=="tab-seo";p.classList.toggle("active",p.id==="tab-seo");});
  }
  function newArticle(){showEditor(newPost());}
  function setField(selector,value){const field=$(selector);if(!field)return;if(field.type==="checkbox")field.checked=value!==false;else field.value=value??"";}
  function fillEditor(post) {
    const fields={
      "#post-title":"title","#post-slug":"slug","#post-excerpt":"excerpt","#post-language":"language",
      "#post-category":"category","#post-hero-url":"hero_image_url",
      "#post-hero-alt":"hero_image_alt","#post-hero-caption":"hero_image_caption","#post-og-url":"og_image_url",
      "#post-seo-title":"seo_title","#post-meta-description":"meta_description","#post-focus-keyword":"focus_keyword",
      "#post-canonical":"canonical_url","#post-og-title":"og_title","#post-og-description":"og_description",
      "#post-robots-index":"robots_index","#post-robots-follow":"robots_follow","#post-featured":"featured",
      "#post-toc":"toc_enabled","#post-dropcap":"drop_cap","#post-width":"content_width","#post-accent":"accent_color",
    };
    Object.entries(fields).forEach(([selector,key])=>setField(selector,post[key]));
    $("#post-content").innerHTML=renderPreviewMarkdown(String(post.content||""));
    $("#post-tags").value=(post.tags||[]).join("، ");
    $("#post-faqs").value=(post.faqs||[]).map((faq)=>"پرسش: "+faq.question+"\nپاسخ: "+faq.answer).join("\n\n");
    updateImagePreview("hero-image-preview",post.hero_image_url,post.hero_image_alt);
    updateImagePreview("og-image-preview",post.og_image_url,post.og_title||post.title);
  }
  function updateImagePreview(id,url,alt) {
    const box=$("#"+id);box.replaceChildren();
    if(!url){const span=document.createElement("span");span.textContent="تصویری انتخاب نشده.";box.appendChild(span);return;}
    const img=document.createElement("img");img.src=url;img.alt=alt||"";box.appendChild(img);
  }
  function parseFaqs(value) {
    return value.split(/\n\s*\n/).map((block)=>{
      const lines=block.split("\n").map((line)=>line.trim()).filter(Boolean);
      if(lines.length<2)return null;
      const question=(lines[0]||"").replace(/^(پرسش|سؤال|Q)\s*[:：]\s*/i,"");
      const answer=lines.slice(1).join(" ").replace(/^(پاسخ|A)\s*[:：]\s*/i,"");
      return question&&answer?{question,answer}:null;
    }).filter(Boolean);
  }
  function collectPost() {
    const post={...(state.currentPost||newPost())};
    document.querySelectorAll("#editor-form [data-field]").forEach((field)=>{
      const key=field.dataset.field;
      post[key]=field.type==="checkbox"?field.checked:field.value.trim();
    });
    post.content=editorToMarkdown($("#post-content"));
    post.tags=$("#post-tags").value.split(/[،,]/).map((s)=>s.trim()).filter(Boolean);
    post.faqs=parseFaqs($("#post-faqs").value);
    return post;
  }
  function updateEditorStatus() {
    const post=state.currentPost||newPost();
    const badge=$("#editor-state");badge.textContent=statusLabels[post.status]||"پیش‌نویس";badge.className="status-badge "+(post.status||"draft");
    $("#publish-status-text").textContent=post.status==="published"?(post.has_unpublished_changes?"تغییراتی داری که هنوز در نسخۀ عمومی منتشر نشدن.":"این مقاله روی وبلاگ عمومی منتشر شده."):"این نوشته هنوز در وبلاگ عمومی منتشر نشده.";
    $("#post-updated").textContent=dateLabel(post.updated_at);
    $("#unpublish-post").hidden=post.status!=="published";$("#archive-post").hidden=post.status==="archived";
    $("#publish-post").textContent=post.status==="published"?"انتشار تغییرات ↗":"انتشار مقاله ↗";
    $("#sidebar-publish").textContent=post.status==="published"?"انتشار تغییرات ↗":"انتشار مقاله ↗";
  }
  async function editPost(id) {
    try{const result=await api("get_post",{id});showEditor(result.post);}
    catch(error){toast(error.message,true);}
  }
  function showTab(name) {
    document.querySelectorAll(".editor-tab").forEach((button)=>button.classList.toggle("active",button.dataset.tab===name));
    document.querySelectorAll(".tab-panel").forEach((panel)=>{panel.hidden=panel.id!=="tab-"+name;panel.classList.toggle("active",panel.id==="tab-"+name);});
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function safeHref(raw) {
    const value=String(raw||"").trim();
    return /^(https?:\/\/|mailto:|\/|#)/i.test(value)&&!/^\/\//.test(value)?value:"#";
  }
  function previewInline(text) {
    let value=escapeHtml(text);
    value=value.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,(_m,alt,url)=>'<img src="'+escapeHtml(safeHref(url))+'" alt="'+alt+'">');
    value=value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(?:\{([^}]*)\})?/g,(_m,label,url,title,options)=>{
      const href=safeHref(url),external=/^https?:\/\//i.test(href);
      const relation=(String(options||"").match(/rel=(follow|nofollow|sponsored|ugc)/i)||[])[1]||"follow";
      const target=(String(options||"").match(/target=(_blank|_self)/i)||[])[1]||(external?"_blank":"_self");
      const rel=[...(relation!=="follow"?[relation]:[]),...(target==="_blank"?["noopener","noreferrer"]:[])].join(" ");
      return '<a href="'+escapeHtml(href)+'"'+(title?' title="'+escapeHtml(title)+'"':"")+' target="'+target+'" data-link-rel="'+relation+'" data-link-target="'+target+'"'+(rel?' rel="'+rel+'"':"")+">"+label+"</a>";
    });
    value=value.replace(/\x60([^\x60]+)\x60/g,"<code>$1</code>");
    value=value.replace(/\+\+([^+]+)\+\+/g,"<u>$1</u>").replace(/~~([^~]+)~~/g,"<del>$1</del>");
    value=value.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>");
    return value;
  }
  function renderPreviewMarkdown(markdown) {
    const output=[];let paragraph=[];
    const close=()=>{if(paragraph.length){output.push("<p>"+previewInline(paragraph.join(" "))+"</p>");paragraph=[];}};
    let list=null;
    const closeList=()=>{if(list){output.push("</"+list+">");list=null;}};
    const lines=markdown.split(/\r?\n/);
    for(let index=0;index<lines.length;index++){
      const line=lines[index];
      if(/^\s*\|?.+\|.+\|?\s*$/.test(line)&&index+1<lines.length&&/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index+1])){
        close();closeList();
        const cells=(value)=>value.trim().replace(/^\||\|$/g,"").split("|").map((cell)=>cell.trim());
        const headers=cells(line),rows=[];
        index+=2;
        while(index<lines.length&&/^\s*\|?.+\|.+\|?\s*$/.test(lines[index])){rows.push(cells(lines[index]));index++;}
        index--;
        output.push("<table><thead><tr>"+headers.map((cell)=>"<th>"+previewInline(cell)+"</th>").join("")+"</tr></thead><tbody>"+rows.map((row)=>"<tr>"+row.map((cell)=>"<td>"+previewInline(cell)+"</td>").join("")+"</tr>").join("")+"</tbody></table>");
        continue;
      }
      if(!line.trim()){close();closeList();return;}
      const heading=line.match(/^(#{1,4})\s+(.+)$/);
      if(heading){close();closeList();const level=Math.max(2,heading[1].length);output.push("<h"+level+">"+previewInline(heading[2])+"</h"+level+">");return;}
      const quote=line.match(/^>\s?(.*)$/);
      if(quote){close();closeList();output.push("<blockquote><p>"+previewInline(quote[1])+"</p></blockquote>");return;}
      const item=line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
      if(item){close();const next=/^\d/.test(item[1])?"ol":"ul";if(list!==next){closeList();list=next;output.push("<"+list+">");}output.push("<li>"+previewInline(item[2])+"</li>");return;}
      if(/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)){close();closeList();output.push("<hr>");continue;}
      closeList();paragraph.push(line.trim());
    }
    close();closeList();return output.join("");
  }
  function inlineToMarkdown(node) {
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||"";
    if(node.nodeType!==Node.ELEMENT_NODE)return "";
    const element=node,tag=element.tagName.toLowerCase();
    if(tag==="br")return "\n";
    if(tag==="img") {
      const src=safeHref(element.getAttribute("src"));
      return src==="#"?"":"!["+((element.getAttribute("alt")||"").replace(/]/g,"\\]"))+"]("+src+")";
    }
    const inner=Array.from(element.childNodes).map(inlineToMarkdown).join("");
    if(tag==="strong"||tag==="b")return "**"+inner+"**";
    if(tag==="em"||tag==="i")return "*"+inner+"*";
    if(tag==="u")return "++"+inner+"++";
    if(tag==="del"||tag==="s"||tag==="strike")return "~~"+inner+"~~";
    if(tag==="code")return "\x60"+inner+"\x60";
    if(tag==="a"){
      const href=safeHref(element.getAttribute("href"));
      if(href==="#")return inner;
      const external=/^https?:\/\//i.test(href);
      const relation=element.dataset.linkRel||((element.getAttribute("rel")||"").split(/\s+/).find((v)=>["nofollow","sponsored","ugc"].includes(v))||"follow");
      const target=element.dataset.linkTarget||element.getAttribute("target")||(external?"_blank":"_self");
      const options=[];
      if(relation!=="follow")options.push("rel="+relation);
      if((external&&target!=="_blank")||(!external&&target==="_blank"))options.push("target="+target);
      return "["+inner+"]("+href+")"+(options.length?"{"+options.join(" ")+"}":"");
    }
    return inner;
  }
  function listToMarkdown(list,depth) {
    const ordered=list.tagName.toLowerCase()==="ol",indent="  ".repeat(depth);
    let number=1;
    return Array.from(list.children).filter((node)=>node.tagName==="LI").map((item)=>{
      const parts=[],nested=[];
      Array.from(item.childNodes).forEach((child)=>{
        if(child.nodeType===Node.ELEMENT_NODE&&["UL","OL"].includes(child.tagName))nested.push(listToMarkdown(child,depth+1));
        else if(child.nodeType===Node.ELEMENT_NODE&&["P","DIV"].includes(child.tagName))parts.push(Array.from(child.childNodes).map(inlineToMarkdown).join(""));
        else parts.push(inlineToMarkdown(child));
      });
      const marker=ordered?(number++)+".":"-";
      return indent+marker+" "+parts.join("").trim()+"\n"+nested.join("\n");
    }).join("\n");
  }
  function blockToMarkdown(node) {
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue?.trim()?"<p>"+escapeHtml(node.nodeValue.trim())+"</p>":"";
    if(node.nodeType!==Node.ELEMENT_NODE)return "";
    const element=node,tag=element.tagName.toLowerCase();
    if(tag==="h2"||tag==="h3"||tag==="h4")return "#".repeat(Number(tag.slice(1)))+" "+Array.from(element.childNodes).map(inlineToMarkdown).join("").trim()+"\n\n";
    if(tag==="p")return Array.from(element.childNodes).map(inlineToMarkdown).join("").trim()+"\n\n";
    if(tag==="ul"||tag==="ol")return listToMarkdown(element,0)+"\n\n";
    if(tag==="blockquote"){
      const inner=Array.from(element.childNodes).map((child)=>child.nodeType===Node.ELEMENT_NODE&&["P","DIV"].includes(child.tagName)?Array.from(child.childNodes).map(inlineToMarkdown).join(""):inlineToMarkdown(child)).join("\n");
      return inner.split("\n").map((line)=>"> "+line).join("\n")+"\n\n";
    }
    if(tag==="pre")return "\x60\x60\x60\n"+(element.textContent||"").replace(/\n+$/,"")+"\n\x60\x60\x60\n\n";
    if(tag==="hr")return "---\n\n";
    if(tag==="table"){
      const rows=Array.from(element.querySelectorAll("tr")).map((row)=>Array.from(row.querySelectorAll("th,td")).map((cell)=>Array.from(cell.childNodes).map(inlineToMarkdown).join("").replace(/\|/g,"\\|").trim()));
      if(!rows.length)return "";
      const width=Math.max(...rows.map((row)=>row.length));
      const render=(row)=>"| "+Array.from({length:width},(_,i)=>row[i]||"").join(" | ")+" |";
      return [render(rows[0]),render(Array.from({length:width},()=> "---")), ...rows.slice(1).map(render)].join("\n")+"\n\n";
    }
    if(tag==="div"||tag==="section") {
      const children=Array.from(element.childNodes);
      const hasBlocks=children.some((child)=>child.nodeType===Node.ELEMENT_NODE&&["P","DIV","H2","H3","H4","UL","OL","BLOCKQUOTE","TABLE","PRE","HR"].includes(child.tagName));
      return hasBlocks?children.map(blockToMarkdown).join(""):Array.from(children).map(inlineToMarkdown).join("").trim()+"\n\n";
    }
    return Array.from(element.childNodes).map(inlineToMarkdown).join("");
  }
  function editorToMarkdown(editor) {
    return Array.from(editor.childNodes).map(blockToMarkdown).join("").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  }
  function cleanClipboardNode(node) {
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue||"");
    if(node.nodeType!==Node.ELEMENT_NODE)return null;
    const source=node,tag=source.tagName.toLowerCase();
    if(["script","style","iframe","object","embed","svg","meta","link"].includes(tag))return null;
    const children=()=>Array.from(source.childNodes).map(cleanClipboardNode).filter(Boolean);
    if(tag==="span"||tag==="font"){
      let fragment=document.createDocumentFragment();children().forEach((child)=>fragment.appendChild(child));
      const style=(source.getAttribute("style")||"").toLowerCase();
      if(/font-weight\s*:\s*(bold|[6-9]00)/.test(style)){const strong=document.createElement("strong");strong.append(fragment);fragment=strong;}
      if(/font-style\s*:\s*italic/.test(style)){const em=document.createElement("em");em.append(fragment);fragment=em;}
      if(/text-decoration[^;]*underline/.test(style)){const underline=document.createElement("u");underline.append(fragment);fragment=underline;}
      return fragment;
    }
    const tags={b:"strong",strong:"strong",i:"em",em:"em",u:"u",s:"del",strike:"del",del:"del",h1:"h2",h2:"h2",h3:"h3",h4:"h4",h5:"h4",h6:"h4"};
    const allowed=new Set(["p","div","h2","h3","h4","ul","ol","li","blockquote","br","hr","pre","code","table","thead","tbody","tfoot","tr","th","td","strong","em","u","del","a"]);
    const outputTag=tags[tag]||tag;
    if(!allowed.has(outputTag)){
      const fragment=document.createDocumentFragment();children().forEach((child)=>fragment.appendChild(child));return fragment;
    }
    const clean=document.createElement(outputTag);
    if(tag==="a"){
      const href=safeHref(source.getAttribute("href"));
      if(href==="#"){const fragment=document.createDocumentFragment();children().forEach((child)=>fragment.appendChild(child));return fragment;}
      clean.setAttribute("href",href);
      const rel=(source.getAttribute("rel")||"").split(/\s+/).find((value)=>["nofollow","sponsored","ugc"].includes(value))||"follow";
      const target=source.getAttribute("target")==="_self"?"_self":source.getAttribute("target")==="_blank"?"_blank":(/^https?:\/\//i.test(href)?"_blank":"_self");
      clean.dataset.linkRel=rel;clean.dataset.linkTarget=target;clean.setAttribute("target",target);
      if(target==="_blank")clean.setAttribute("rel",([rel==="follow"?[]:[rel],"noopener","noreferrer"].flat()).join(" "));
      else if(rel!=="follow")clean.setAttribute("rel",rel);
    }
    if(tag==="th"||tag==="td"){
      const colspan=Number(source.getAttribute("colspan")||1);
      if(colspan>1)clean.setAttribute("colspan",String(Math.min(12,colspan)));
    }
    children().forEach((child)=>clean.appendChild(child));
    return clean;
  }
  function sanitizeClipboardHtml(html) {
    const parsed=new DOMParser().parseFromString(html,"text/html");
    const wrapper=document.createElement("div");
    Array.from(parsed.body.childNodes).map(cleanClipboardNode).filter(Boolean).forEach((node)=>wrapper.appendChild(node));
    return wrapper.innerHTML;
  }
  function insertHtmlAtCaret(html) {
    const editor=$("#post-content"),selection=window.getSelection();
    let range;
    if(selection&&selection.rangeCount&&editor.contains(selection.anchorNode))range=selection.getRangeAt(0);
    else{range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}
    range.deleteContents();
    const template=document.createElement("template");template.innerHTML=html;
    const fragment=template.content,last=fragment.lastChild;
    range.insertNode(fragment);
    if(last){range.setStartAfter(last);range.collapse(true);selection?.removeAllRanges();selection?.addRange(range);}
    editor.focus();updatePreview();updateSeo();refreshLinkManager();
  }
  function handleEditorPaste(event) {
    event.preventDefault();
    const html=event.clipboardData?.getData("text/html")||"";
    if(html){insertHtmlAtCaret(sanitizeClipboardHtml(html));return;}
    const plain=event.clipboardData?.getData("text/plain")||"";
    const safe=plain.split(/\r?\n/).map((line)=>line.trim()?("<p>"+escapeHtml(line)+"</p>"):"").join("");
    insertHtmlAtCaret(safe);
  }
  function refreshLinkManager() {
    const editor=$("#post-content"),list=$("#link-settings-list");
    if(!editor||!list)return;
    const links=Array.from(editor.querySelectorAll("a[href]"));
    list.replaceChildren();
    if(!links.length){const empty=document.createElement("p");empty.className="link-manager-empty";empty.textContent="هنوز پیوندی در متن وجود نداره. می‌تونی از نوار ابزار لینک اضافه کنی.";list.appendChild(empty);return;}
    links.forEach((anchor,index)=>{
      const row=document.createElement("div");row.className="link-manager-row";
      const details=document.createElement("div");details.className="link-manager-details";
      const label=document.createElement("strong");label.textContent=(anchor.textContent||"پیوند بدون عنوان").trim();
      const url=document.createElement("small");url.textContent=anchor.href;url.dir="ltr";
      details.append(label,url);
      const relationLabel=document.createElement("label");relationLabel.textContent="نوع لینک";
      const relation=document.createElement("select");relation.setAttribute("aria-label","نوع لینک برای "+(anchor.textContent||"پیوند "+(index+1)));
      [["follow","Follow · دنبال‌شونده"],["nofollow","Nofollow · دنبال‌نشونده"],["sponsored","Sponsored · تبلیغاتی"],["ugc","UGC · محتوای کاربر"]].forEach(([value,title])=>{const option=document.createElement("option");option.value=value;option.textContent=title;relation.appendChild(option);});
      relation.value=anchor.dataset.linkRel||((anchor.rel||"").split(/\s+/).find((v)=>["nofollow","sponsored","ugc"].includes(v))||"follow");
      relation.addEventListener("change",()=>{anchor.dataset.linkRel=relation.value;if(relation.value==="follow")anchor.removeAttribute("data-link-rel");anchor.rel=[...(relation.value==="follow"?[]:[relation.value]),...(anchor.target==="_blank"?["noopener","noreferrer"]:[])].join(" ");updatePreview();updateSeo();});
      const targetLabel=document.createElement("label");targetLabel.textContent="بازشدن";
      const target=document.createElement("select");target.setAttribute("aria-label","نحوۀ بازشدن "+(anchor.textContent||"پیوند "+(index+1)));
      [["auto","پیش‌فرض"],["_self","همین زبانه"],["_blank","زبانه جدید"]].forEach(([value,title])=>{const option=document.createElement("option");option.value=value;option.textContent=title;target.appendChild(option);});
      target.value=anchor.dataset.linkTarget||anchor.target||"auto";
      target.addEventListener("change",()=>{const external=/^https?:\/\//i.test(anchor.href);const value=target.value==="auto"?(external?"_blank":"_self"):target.value;anchor.dataset.linkTarget=value;if(value==="_self")anchor.setAttribute("target","_self");else anchor.setAttribute("target","_blank");const rel=anchor.dataset.linkRel||"follow";anchor.rel=[...(rel==="follow"?[]:[rel]),...(value==="_blank"?["noopener","noreferrer"]:[])].join(" ");updatePreview();updateSeo();});
      const controls=document.createElement("div");controls.className="link-manager-controls";
      controls.append(relationLabel,relation,targetLabel,target);row.append(details,controls);list.appendChild(row);
    });
  }
  function insertLink() {
    const editor=$("#post-content");editor.focus();
    const selected=window.getSelection()?.toString()||"";
    const raw=window.prompt("آدرس پیوند را وارد کن:","https://");
    if(!raw)return;
    const href=safeHref(raw);
    if(href==="#"){toast("این نوع آدرس برای پیوند مجاز نیست.",true);return;}
    if(selected){document.execCommand("createLink",false,href);}
    else{
      const label=window.prompt("متن نمایشی پیوند را وارد کن:","مشاهدۀ منبع");
      if(!label)return;
      insertHtmlAtCaret('<a href="'+escapeHtml(href)+'" target="'+(/^https?:\/\//i.test(href)?"_blank":"_self")+'" data-link-rel="follow" data-link-target="'+(/^https?:\/\//i.test(href)?"_blank":"_self")+'">'+escapeHtml(label)+"</a>");
      return;
    }
    const selection=window.getSelection(),node=selection?.anchorNode;
    const anchor=node instanceof Element?node.closest("a"):node?.parentElement?.closest("a");
    if(anchor){anchor.dataset.linkRel="follow";anchor.dataset.linkTarget=/^https?:\/\//i.test(href)?"_blank":"_self";if(anchor.target==="_blank")anchor.rel="noopener noreferrer";}
    updatePreview();updateSeo();refreshLinkManager();
  }
  function updatePreview() {
    const title=$("#post-title").value||"عنوان مقاله";
    const content=editorToMarkdown($("#post-content"));
    $("#google-preview").dir=$("#post-language").value==="fa"?"rtl":"ltr";
    $("#post-content").dir=$("#post-language").value==="fa"?"rtl":"ltr";
    $("#preview-content").innerHTML="<h1>"+escapeHtml(title)+"</h1>"+renderPreviewMarkdown(content);
  }
  function updateSeo() {
    const title=$("#post-title").value.trim(), slug=$("#post-slug").value.trim();
    const seoTitle=$("#post-seo-title").value.trim()||title;
    const description=$("#post-meta-description").value.trim()||$("#post-excerpt").value.trim();
    const keyword=$("#post-focus-keyword").value.trim().toLocaleLowerCase();
    const content=editorToMarkdown($("#post-content"));
    const firstParagraph=content.split(/\n\s*\n/)[0]||"";
    const checks=[
      {label:"عنوان SEO در بازۀ پیشنهادی ۳۰ تا ۶۵ نویسه",pass:seoTitle.length>=30&&seoTitle.length<=65},
      {label:"توضیحات متا بین ۱۲۰ تا ۱۶۰ نویسه",pass:description.length>=120&&description.length<=160},
      {label:"کلمۀ کلیدی در عنوان",pass:!!keyword&&title.toLocaleLowerCase().includes(keyword)},
      {label:"نامک کوتاه و خوانا",pass:/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)},
      {label:"کلمۀ کلیدی در ابتدای متن",pass:!!keyword&&firstParagraph.toLocaleLowerCase().includes(keyword)},
      {label:"ساختار تیترهای مقاله",pass:(content.match(/^#{2,4}\s/gm)||[]).length>=2},
      {label:"متن جایگزین تصویر",pass:!$("#post-hero-url").value||!!$("#post-hero-alt").value.trim()},
      {label:"تصویر اجتماعی اختصاصی",pass:!!$("#post-og-url").value||!!$("#post-hero-url").value},
      {label:"Canonical URL معتبر یا خودکار",pass:!$("#post-canonical").value.trim()||$("#post-canonical").value.startsWith("https://ariakianzad.github.io/blog/")},
    ];
    const score=Math.round(checks.filter((c)=>c.pass).length/checks.length*100);
    $("#seo-score").textContent=score.toLocaleString("fa-IR")+" / ۱۰۰";
    const list=$("#seo-checks");list.replaceChildren();
    checks.forEach((check)=>{const li=document.createElement("li");li.textContent=check.label;li.className=check.pass?"pass":"";list.appendChild(li);});
    $("#seo-title-count").textContent=seoTitle.length.toLocaleString("fa-IR")+" / ۶۰";
    $("#seo-description-count").textContent=description.length.toLocaleString("fa-IR")+" / ۱۶۰";
    $("#seo-preview-url").textContent="https://ariakianzad.github.io/blog/"+(slug||"article-slug")+"/";
    $("#seo-preview-title").textContent=seoTitle||"عنوان مقاله";
    $("#seo-preview-description").textContent=description||"توضیحات مقاله در نتایج جست‌وجو اینجا نمایش داده می‌شه.";
  }
  async function savePost() {
    const post=collectPost();
    const result=await api("save_post",{post});
    state.currentPost=result.post;
    await loadPosts();updateEditorStatus();
    toast("پیش‌نویس ذخیره شد.");
    return result.post;
  }
  async function publishPost() {
    const post=await savePost();
    const result=await api("publish_post",{id:post.id});
    state.currentPost=result.post;await loadPosts();updateEditorStatus();
    toast("درخواست انتشار ثبت شد. بعد از تکمیل Build مقاله روی سایت قرار می‌گیره.");
  }
  async function changeStatus(action) {
    const post=state.currentPost;if(!post?.id)return;
    if(!window.confirm(action==="archive_post"?"این مقاله به بایگانی منتقل بشه؟":"این مقاله از وبلاگ عمومی خارج بشه؟"))return;
    const result=await api(action,{id:post.id});state.currentPost=result.post;await loadPosts();updateEditorStatus();
    toast(action==="archive_post"?"مقاله بایگانی شد.":"مقاله از انتشار خارج شد.");
  }
  function canvasBlob(canvas,type,quality) {
    return new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error("تبدیل تصویر ناموفق بود.")),type,quality));
  }
  async function compressImage(file) {
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("فقط تصویر JPG، PNG یا WebP پذیرفته می‌شه.");
    const bitmap=await createImageBitmap(file);
    const maxEdge=1800,scale=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext("2d",{alpha:false});
    if(!context)throw new Error("مرورگر امکان فشرده‌سازی تصویر رو فراهم نکرد.");
    context.fillStyle="#f4f1e9";context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    let blob=await canvasBlob(canvas,"image/webp",0.84);
    if(blob.size>3*1024*1024)blob=await canvasBlob(canvas,"image/webp",0.72);
    if(blob.size>3*1024*1024)blob=await canvasBlob(canvas,"image/webp",0.6);
    if(blob.size>3*1024*1024)throw new Error("حجم تصویر بعد از فشرده‌سازی هنوز بیشتر از ۳ مگابایته.");
    return blob;
  }
  async function uploadImage(file) {
    toast("در حال بهینه‌سازی تصویر…");
    const blob=await compressImage(file);
    const form=new FormData();form.append("action","upload_image");form.append("file",blob,"blog-image.webp");
    const result=await uploadRequest(form,false);
    return result.url;
  }
  async function handleImage(inputId,urlId,previewId,altSelector) {
    const input=$("#"+inputId),file=input.files?.[0];if(!file)return;
    try {
      input.disabled=true;
      const url=await uploadImage(file);$("#"+urlId).value=url;
      updateImagePreview(previewId,url,$(altSelector)?.value||"");
      toast("تصویر فشرده و بارگذاری شد.");
      updateSeo();
    } catch(error) {toast(error.message,true);}
    finally {input.disabled=false;input.value="";}
  }
  function parseSettingsForm(settings) {
    const get=(id)=>$("#"+id).value;
    const check=(id)=>$("#"+id).checked;
    return {
      title:get("setting-title"),tagline:get("setting-tagline"),description:get("setting-description"),
      background_theme:document.querySelector('input[name="setting-theme"]:checked')?.value||"paper",
      accent_color:get("setting-accent"),card_style:get("setting-card-style"),layout_style:get("setting-layout"),
      content_width:get("setting-width"),default_language:get("setting-language"),posts_per_page:Number(get("setting-per-page")),
      heading_scale:Number(get("setting-heading-scale")),body_line_height:Number(get("setting-line-height")),
      intro_title:get("setting-intro-title"),intro_body:get("setting-intro-body"),
      show_search:check("setting-search"),show_categories:check("setting-categories"),
      show_featured:check("setting-featured"),show_reading_time:check("setting-readtime"),
      show_toc:check("setting-toc"),show_related_posts:check("setting-related"),show_share:check("setting-share"),
      enable_rss:check("setting-rss"),default_meta_title:get("setting-meta-title"),default_meta_description:get("setting-meta-description"),
      footer_note:get("setting-footer"),default_og_image:settings?.default_og_image||"",
    };
  }
  function fillSettings(settings) {
    state.settings=settings;
    const set=(id,value)=>{if($("#"+id))$("#"+id).value=value??"";};
    const check=(id,value)=>{if($("#"+id))$("#"+id).checked=value!==false;};
    set("setting-title",settings.title);set("setting-tagline",settings.tagline);set("setting-description",settings.description);
    set("setting-intro-title",settings.intro_title);set("setting-intro-body",settings.intro_body);set("setting-footer",settings.footer_note);
    set("setting-accent",settings.accent_color||"#a86f54");set("setting-card-style",settings.card_style);set("setting-layout",settings.layout_style);
    set("setting-width",settings.content_width);set("setting-language",settings.default_language);set("setting-per-page",settings.posts_per_page);
    set("setting-heading-scale",settings.heading_scale);set("setting-line-height",settings.body_line_height);
    set("setting-meta-title",settings.default_meta_title);set("setting-meta-description",settings.default_meta_description);
    const theme=document.querySelector('input[name="setting-theme"][value="'+(settings.background_theme||"paper")+'"]');if(theme)theme.checked=true;
    check("setting-search",settings.show_search);check("setting-categories",settings.show_categories);
    check("setting-featured",settings.show_featured);check("setting-readtime",settings.show_reading_time);
    check("setting-toc",settings.show_toc);check("setting-related",settings.show_related_posts);
    check("setting-share",settings.show_share);check("setting-rss",settings.enable_rss);
    updateImagePreview("setting-og-preview",settings.default_og_image,"تصویر پیش‌فرض وبلاگ");
  }
  async function loadSettings() {
    const result=await api("get_settings");fillSettings(result.settings||{});
  }
  async function saveSettings(event) {
    event.preventDefault();
    const button=$("#save-settings");setButton(button,true,"در حال ذخیره…");
    try {
      const result=await api("save_settings",{settings:parseSettingsForm(state.settings)});
      state.settings=result.settings;
      if(result.buildDispatched){
        $("#settings-message").textContent="تنظیمات ذخیره شد و Build آغاز شد.";
        toast("تنظیمات ذخیره شد. بعد از Build تغییرات روی سایت دیده می‌شن.");
      }else{
        $("#settings-message").textContent="تنظیمات در Supabase ذخیره شد؛ انتشار عمومی منتظر تنظیم GitHub Token است.";
        toast("تنظیمات ذخیره شد. برای اعمال روی سایت، GitHub Token انتشار رو در Supabase ثبت کن.",true);
      }
    }catch(error){toast(error.message,true);}
    finally{setButton(button,false);}
  }
  async function loadWorkspace() {
    const results=await Promise.all([api("list_posts"),api("get_settings")]);
    state.posts=Array.isArray(results[0].posts)?results[0].posts:[];
    state.settings=results[1].settings||{};
    renderOverview();renderPosts();fillSettings(state.settings);
  }
  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((button)=>button.addEventListener("click",()=>{
      const name=button.dataset.view;showView(name);if(name==="settings")void loadSettings().catch((e)=>toast(e.message,true));
    }));
    document.querySelectorAll("[data-new-post]").forEach((button)=>button.addEventListener("click",newArticle));
    $("#back-to-posts").addEventListener("click",()=>showView("posts"));
    document.querySelectorAll(".editor-tab").forEach((button)=>button.addEventListener("click",()=>showTab(button.dataset.tab)));
    $("#posts-search").addEventListener("input",renderPosts);$("#posts-filter").addEventListener("change",renderPosts);
    $("#post-content").addEventListener("input",()=>{updatePreview();updateSeo();refreshLinkManager();});
    $("#post-content").addEventListener("paste",handleEditorPaste);
    $("#link-settings-toggle").addEventListener("click",()=>{const panel=$("#link-settings");panel.hidden=!panel.hidden;refreshLinkManager();});
    document.querySelectorAll("[data-command]").forEach((button)=>button.addEventListener("click",()=>{
      $("#post-content").focus();
      document.execCommand(button.dataset.command,false,button.dataset.value||null);
      updatePreview();updateSeo();refreshLinkManager();
    }));
    $("#insert-link").addEventListener("click",insertLink);
    ["#post-title","#post-slug","#post-excerpt","#post-seo-title","#post-meta-description","#post-focus-keyword","#post-hero-alt","#post-canonical"]
      .forEach((selector)=>$(selector).addEventListener("input",updateSeo));
    $("#post-title").addEventListener("input",()=>{if(!$("#post-slug").value)$("#post-slug").value=slugSuggestion($("#post-title").value);});
    $("#preview-toggle").addEventListener("click",()=>{
      state.preview=!state.preview;$("#post-content").hidden=state.preview;$("#markdown-preview").hidden=!state.preview;
      $("#editor-workarea").classList.toggle("preview-mode",state.preview);
      $("#preview-toggle").textContent=state.preview?"بازگشت به ویرایش":"پیش‌نمایش";
      updatePreview();
    });

    $("#save-post").addEventListener("click",()=>void savePost().catch((e)=>toast(e.message,true)));
    $("#sidebar-save").addEventListener("click",()=>void savePost().catch((e)=>toast(e.message,true)));
    $("#publish-post").addEventListener("click",()=>void publishPost().catch((e)=>toast(e.message,true)));
    $("#sidebar-publish").addEventListener("click",()=>void publishPost().catch((e)=>toast(e.message,true)));
    $("#unpublish-post").addEventListener("click",()=>void changeStatus("unpublish_post").catch((e)=>toast(e.message,true)));
    $("#archive-post").addEventListener("click",()=>void changeStatus("archive_post").catch((e)=>toast(e.message,true)));
    $("#hero-image-file").addEventListener("change",()=>void handleImage("hero-image-file","post-hero-url","hero-image-preview","#post-hero-alt"));
    $("#og-image-file").addEventListener("change",()=>void handleImage("og-image-file","post-og-url","og-image-preview","#post-og-title"));
    $("#setting-og-file").addEventListener("change",async(event)=>{
      const file=event.target.files?.[0];if(!file)return;
      try{
        const url=await uploadImage(file);
        state.settings={...(state.settings||{}),default_og_image:url};
        updateImagePreview("setting-og-preview",url,"تصویر پیش‌فرض وبلاگ");
        toast("تصویر پیش‌فرض فشرده و بارگذاری شد.");
      }catch(error){toast(error.message,true);}
      finally{event.target.value="";}
    });
    $("#settings-form").addEventListener("submit",saveSettings);
    $("#logout-button").addEventListener("click",()=>void logout(true));
    $("#header-logout-button").addEventListener("click",()=>void logout(true));
    $("#forgot-password").addEventListener("click",async()=>{
      const email=$("#login-email").value.trim();if(!email){$("#login-message").textContent="اول ایمیلت رو وارد کن.";return;}
      try{
        const response=await fetch(supabaseUrl+"/auth/v1/recover?redirect_to="+encodeURIComponent("https://ariakianzad.github.io/admin/blog/"),{
          method:"POST",headers:{apikey:anonKey,"Content-Type":"application/json"},body:JSON.stringify({email})
        });
        await parseResponse(response);$("#login-message").textContent="اگر حسابی با این ایمیل وجود داشته باشه، لینک بازیابی ارسال می‌شه.";
      }catch(error){$("#login-message").textContent=error.message;}
    });
  }
  function slugSuggestion(title) {
    return title.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/[\s_]+/g,"-").replace(/-+/g,"-").slice(0,100);
  }
  function showView(name) {
    document.querySelectorAll(".view").forEach((view)=>{view.hidden=view.id!=="view-"+name;view.classList.toggle("active",view.id==="view-"+name);});
    document.querySelectorAll(".side-link").forEach((button)=>button.classList.toggle("active",button.dataset.view===name));
    $("#workspace-title").textContent=({overview:"نمای کلی",posts:"مقاله‌ها",editor:"ویرایش مقاله",settings:"تنظیمات بلاگ"})[name]||"مدیریت";
    if(name==="posts")renderPosts();
  }
  $("#login-form").addEventListener("submit",async(event)=>{
    event.preventDefault();if(!validConfig){$("#login-message").textContent="تنظیمات اتصال Supabase معتبر نیست.";return;}
    const button=$("#login-submit");setButton(button,true,"در حال بررسی…");$("#login-message").textContent="";
    try{
      await signIn($("#login-email").value.trim(),$("#login-password").value);
      const user=await fetch(supabaseUrl+"/auth/v1/user",{headers:{apikey:anonKey,Authorization:"Bearer "+state.accessToken}});
      const userData=await parseResponse(user);window.blogAdminEmail=userData.email||"مدیر";
      await loadWorkspace();showApp();showView("overview");
    }catch(error){state.accessToken="";state.refreshToken="";$("#login-password").value="";$("#login-message").textContent=error.message;}
    finally{setButton(button,false);}
  });
  bindEvents();
  if(!validConfig){$("#login-submit").disabled=true;$("#login-message").textContent="اتصال امن داشبورد پیکربندی نشده.";}
})();