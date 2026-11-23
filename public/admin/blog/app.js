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
    document.querySelectorAll(".editor-tab").forEach((b)=>b.classList.toggle("active",b.dataset.tab==="seo"));
    document.querySelectorAll(".tab-panel").forEach((p)=>{p.hidden=p.id!=="tab-seo";p.classList.toggle("active",p.id==="tab-seo");});
  }
  function newArticle(){showEditor(newPost());}
  function setField(selector,value){const field=$(selector);if(!field)return;if(field.type==="checkbox")field.checked=value!==false;else field.value=value??"";}
  function fillEditor(post) {
    const fields={
      "#post-title":"title","#post-slug":"slug","#post-excerpt":"excerpt","#post-language":"language",
      "#post-category":"category","#post-content":"content","#post-hero-url":"hero_image_url",
      "#post-hero-alt":"hero_image_alt","#post-hero-caption":"hero_image_caption","#post-og-url":"og_image_url",
      "#post-seo-title":"seo_title","#post-meta-description":"meta_description","#post-focus-keyword":"focus_keyword",
      "#post-canonical":"canonical_url","#post-og-title":"og_title","#post-og-description":"og_description",
      "#post-robots-index":"robots_index","#post-robots-follow":"robots_follow","#post-featured":"featured",
      "#post-toc":"toc_enabled","#post-dropcap":"drop_cap","#post-width":"content_width","#post-accent":"accent_color",
    };
    Object.entries(fields).forEach(([selector,key])=>setField(selector,post[key]));
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
    value=value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_m,label,url)=>'<a href="'+escapeHtml(safeHref(url))+'">'+label+"</a>");
    value=value.replace(/\x60([^\x60]+)\x60/g,"<code>$1</code>");
    value=value.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>");
    return value;
  }
  function renderPreviewMarkdown(markdown) {
    const output=[];let paragraph=[];
    const close=()=>{if(paragraph.length){output.push("<p>"+previewInline(paragraph.join(" "))+"</p>");paragraph=[];}};
    let list=null;
    const closeList=()=>{if(list){output.push("</"+list+">");list=null;}};
    markdown.split(/\r?\n/).forEach((line)=>{
      if(!line.trim()){close();closeList();return;}
      const heading=line.match(/^(#{1,4})\s+(.+)$/);
      if(heading){close();closeList();const level=Math.max(2,heading[1].length);output.push("<h"+level+">"+previewInline(heading[2])+"</h"+level+">");return;}
      const quote=line.match(/^>\s?(.*)$/);
      if(quote){close();closeList();output.push("<blockquote><p>"+previewInline(quote[1])+"</p></blockquote>");return;}
      const item=line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
      if(item){close();const next=/^\d/.test(item[1])?"ol":"ul";if(list!==next){closeList();list=next;output.push("<"+list+">");}output.push("<li>"+previewInline(item[2])+"</li>");return;}
      closeList();paragraph.push(line.trim());
    });
    close();closeList();return output.join("");
  }
  function updatePreview() {
    const title=$("#post-title").value||"عنوان مقاله";
    $("#google-preview").dir=$("#post-language").value==="fa"?"rtl":"ltr";
    $("#post-content").dir=$("#post-language").value==="fa"?"rtl":"ltr";
    $("#preview-content").innerHTML="<h1>"+escapeHtml(title)+"</h1>"+renderPreviewMarkdown($("#post-content").value);
  }
  function updateSeo() {
    const title=$("#post-title").value.trim(), slug=$("#post-slug").value.trim();
    const seoTitle=$("#post-seo-title").value.trim()||title;
    const description=$("#post-meta-description").value.trim()||$("#post-excerpt").value.trim();
    const keyword=$("#post-focus-keyword").value.trim().toLocaleLowerCase();
    const content=$("#post-content").value;
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
    $("#post-content").addEventListener("input",()=>{updatePreview();updateSeo();});
    ["#post-title","#post-slug","#post-excerpt","#post-seo-title","#post-meta-description","#post-focus-keyword","#post-hero-alt","#post-canonical"]
      .forEach((selector)=>$(selector).addEventListener("input",updateSeo));
    $("#post-title").addEventListener("input",()=>{if(!$("#post-slug").value)$("#post-slug").value=slugSuggestion($("#post-title").value);});
    $("#preview-toggle").addEventListener("click",()=>{
      state.preview=!state.preview;$("#post-content").hidden=state.preview;$("#markdown-preview").hidden=!state.preview;
      $("#editor-workarea").classList.toggle("preview-mode",state.preview);
      $("#preview-toggle").textContent=state.preview?"بازگشت به ویرایش":"پیش‌نمایش";
      updatePreview();
    });
    document.querySelectorAll("[data-insert]").forEach((button)=>button.addEventListener("click",()=>{
      const area=$("#post-content"),text=button.dataset.insert||"",start=area.selectionStart,end=area.selectionEnd;
      area.setRangeText(text,start,end,"select");area.focus();updatePreview();updateSeo();
    }));
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