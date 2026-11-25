(() => {
  "use strict";
  const config = window.MIAN_E_MA_DASHBOARD_CONFIG || {};
  const supabaseUrl = typeof config.supabaseUrl === "string" ? config.supabaseUrl.replace(/\/+$/,"") : "";
  const anonKey = typeof config.supabaseAnonKey === "string" ? config.supabaseAnonKey : "";
  const $ = (selector) => document.querySelector(selector);
  const state = { accessToken:"", refreshToken:"", posts:[], currentPost:null, settings:null, busy:false, preview:false, articleAnalytics:null, analyticsBusy:false, analyticsEpoch:0, analyticsVisited:false, analyticsLastFetchedAt:0, adBanners:[], adClickCounts:{}, adClickCountsBusy:false, adClickCountsUnavailable:false, editorDirty:false, editorChangeVersion:0, postSaveBusy:false, publishBusy:false, statusBusy:false };
  const statusLabels = { draft:"پیش‌نویس", published:"منتشرشده", archived:"بایگانی" };
  const validConfig = supabaseUrl === "https://bkohdqwecnvbmeaiuyyx.supabase.co" && anonKey.startsWith("sb_publishable_");

  function updateEditorDirtyIndicator() {
    const indicator=$("#editor-dirty-indicator");
    if(!indicator)return;
    indicator.hidden=!state.editorDirty;
    indicator.textContent=state.editorDirty?"تغییرات ذخیره‌نشده":"همۀ تغییرات ذخیره شدن";
  }
  function markEditorDirty() {
    if($("#view-editor")?.hidden)return;
    state.editorChangeVersion+=1;
    state.editorDirty=true;
    updateEditorDirtyIndicator();
  }
  function clearEditorDirty() {
    state.editorDirty=false;
    updateEditorDirtyIndicator();
  }
  function confirmLeaveEditor() {
    if($("#view-editor")?.hidden)return true;
    if(state.postSaveBusy||state.publishBusy||state.statusBusy){
      toast("یک عملیات روی مقاله در حال انجامه؛ تا پایانش از ویرایش خارج نشو.",true);
      return false;
    }
    if(!state.editorDirty)return true;
    const confirmed=window.confirm("تغییرات این مقاله هنوز ذخیره نشدن. بدون ذخیره از ویرایش خارج بشیم؟");
    if(confirmed)clearEditorDirty();
    return confirmed;
  }

  window.addEventListener("beforeunload",(event)=>{
    if(!state.editorDirty)return;
    event.preventDefault();
    event.returnValue="";
  });

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
  async function saveBrowserCredential() {
    if(!window.PasswordCredential||!navigator.credentials?.store)return false;
    try{
      const form=$("#login-form");
      const credential=new window.PasswordCredential(form);
      await navigator.credentials.store(credential);
      return true;
    }catch{return false;}
  }
  async function finishSignIn(email,password,remember,quiet) {
    state.analyticsEpoch+=1;state.articleAnalytics=null;state.analyticsBusy=false;state.analyticsVisited=false;state.analyticsLastFetchedAt=0;
    await signIn(email,password);
    const user=await fetch(supabaseUrl+"/auth/v1/user",{headers:{apikey:anonKey,Authorization:"Bearer "+state.accessToken}});
    const userData=await parseResponse(user);window.blogAdminEmail=userData.email||"مدیر";
    await loadWorkspace();
    let credentialSaved=false;
    if(remember&&!quiet)credentialSaved=await saveBrowserCredential();
    else if(!remember&&navigator.credentials?.preventSilentAccess)await navigator.credentials.preventSilentAccess().catch(()=>{});
    showApp();showView("overview");
    if(remember&&!quiet){
      if(credentialSaved)toast("اطلاعات ورود به مدیر گذرواژۀ مرورگر سپرده شد.",false);
      else toast("ذخیرۀ مستقیم در این مرورگر در دسترس نبود. اگر مرورگر پیشنهاد ذخیرۀ رمز داد، تأییدش کن؛ در غیر این صورت از تکمیل خودکار رمز مرورگر استفاده کن.",false);
    }
  }
  async function restoreRememberedCredential() {
    if(!window.PasswordCredential||!navigator.credentials?.get)return;
    try{
      const credential=await navigator.credentials.get({password:true,mediation:"silent"});
      if(!credential||credential.type!=="password"||!credential.password)return;
      $("#login-email").value=credential.id||"";
      $("#login-password").value=credential.password;
      $("#remember-me").checked=true;
    }catch{
      // Native browser password-manager autofill remains available as a fallback.
    }
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
  async function siteAnalytics(mode,retried) {
    const response=await fetch(supabaseUrl+"/functions/v1/site-analytics",{
      method:"POST",
      headers:{apikey:anonKey,Authorization:"Bearer "+state.accessToken,"Content-Type":"application/json"},
      body:JSON.stringify({mode})
    });
    if(response.status===401&&!retried&&await refreshSession())return siteAnalytics(mode,true);
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
    if(!confirmLeaveEditor())return;
    const token=state.accessToken;
    if(navigator.credentials?.preventSilentAccess)navigator.credentials.preventSilentAccess().catch(()=>{});
    state.analyticsEpoch+=1;state.articleAnalytics=null;state.analyticsBusy=false;state.analyticsVisited=false;state.analyticsLastFetchedAt=0;
    state.accessToken="";state.refreshToken="";state.posts=[];state.currentPost=null;state.settings=null;state.adBanners=[];
    if(revoke!==false&&token&&validConfig){
      fetch(supabaseUrl+"/auth/v1/logout?scope=local",{method:"POST",headers:{apikey:anonKey,Authorization:"Bearer "+token}}).catch(()=>{});
    }
    showLogin("از حساب خارج شدی.");
  }
  function dateLabel(value) {
    if(!value)return "—";
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"short",day:"numeric",timeZone:"Asia/Tehran"}).format(new Date(value));
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
    [postCategorySlugs(post).map((slug)=>getConfiguredCategories(state.settings).find((item)=>item.slug===slug)?.name||slug).join("، ")||"بدون دسته‌بندی",dateLabel(post.updated_at)," / "+(post.slug||"بدون نامک")].forEach((value)=>{const span=document.createElement("span");span.textContent=value;sub.appendChild(span);});
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
      (!needle||[post.title,post.slug,...postCategorySlugs(post)].join(" ").toLocaleLowerCase().includes(needle)));
    const grid=$("#posts-grid");grid.replaceChildren();
    posts.forEach((post)=>grid.appendChild(createPostRow(post)));
    const empty=$("#posts-empty");
    empty.hidden=posts.length>0;
    if(!posts.length){
      empty.textContent=state.posts.length
        ? "با این جست‌وجو یا فیلتر، مقاله‌ای پیدا نشد."
        : "هنوز مقاله‌ای ایجاد نکردی. از «نوشتۀ تازه» برای شروع استفاده کن.";
    }
  }
  function formatMetric(value) {
    return Number(value||0).toLocaleString("fa-IR");
  }
  function analyticsMetric(label,value,detail) {
    const item=document.createElement("div");item.className="article-analytics-metric";
    const caption=document.createElement("span");caption.textContent=label;
    const amount=document.createElement("strong");amount.textContent=value;
    item.append(caption,amount);
    if(detail){const note=document.createElement("small");note.textContent=detail;item.appendChild(note);}
    return item;
  }
  function renderArticleAnalyticsChart(history) {
    const wrap=$("#article-analytics-chart-wrap");
    const empty=$("#article-analytics-chart-empty");
    const grid=$("#article-analytics-chart-grid");
    const area=$("#article-analytics-chart-area");
    const line=$("#article-analytics-chart-line");
    const points=$("#article-analytics-chart-points");
    const labels=$("#article-analytics-chart-labels");
    if(!wrap||!empty||!grid||!area||!line||!points||!labels)return;
    const rows=(Array.isArray(history)?history:[])
      .filter((item)=>/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||"")))
      .map((item)=>({date:String(item.date),pageViews:Math.max(0,Number(item.pageViews)||0)}))
      .sort((a,b)=>a.date.localeCompare(b.date));
    grid.replaceChildren();points.replaceChildren();labels.replaceChildren();
    if(!rows.length){
      wrap.hidden=true;empty.hidden=false;
      empty.textContent="در این بازه هنوز دادهٔ روزانه‌ای برای نمایش نمودار برنگشته."; 
      area.setAttribute("d","");line.setAttribute("d","");
      return;
    }
    wrap.hidden=false;empty.hidden=true;
    const width=900,height=220,left=12,right=12,top=16,bottom=28;
    const plotWidth=width-left-right,plotHeight=height-top-bottom;
    const maxValue=Math.max(1,...rows.map((r)=>r.pageViews));
    const xAt=(i)=>rows.length===1?left+plotWidth/2:left+i*plotWidth/(rows.length-1);
    const yAt=(value)=>top+plotHeight-(value/maxValue)*plotHeight;
    [0,.5,1].forEach((fraction)=>{
      const y=top+plotHeight*fraction;
      const rule=document.createElementNS("http://www.w3.org/2000/svg","line");
      rule.setAttribute("x1",String(left));rule.setAttribute("x2",String(width-right));
      rule.setAttribute("y1",String(y));rule.setAttribute("y2",String(y));
      grid.appendChild(rule);
    });
    const linePath=rows.map((r,i)=>(i?"L":"M")+xAt(i).toFixed(2)+" "+yAt(r.pageViews).toFixed(2)).join(" ");
    const baseline=top+plotHeight;
    const areaPath=linePath+" L "+xAt(rows.length-1).toFixed(2)+" "+baseline+" L "+xAt(0).toFixed(2)+" "+baseline+" Z";
    line.setAttribute("d",linePath);area.setAttribute("d",areaPath);
    rows.forEach((r,i)=>{
      const point=document.createElementNS("http://www.w3.org/2000/svg","circle");
      point.setAttribute("cx",String(xAt(i)));point.setAttribute("cy",String(yAt(r.pageViews)));point.setAttribute("r",rows.length>20?"3":"4.5");
      point.setAttribute("class","article-analytics-chart-point");
      point.setAttribute("aria-label",r.date+": "+formatMetric(r.pageViews));
      points.appendChild(point);
    });
    const labelIndexes=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])];
    labelIndexes.forEach((index)=>{
      const span=document.createElement("span");
      const date=new Date(rows[index].date+"T12:00:00Z");
      span.textContent=Number.isNaN(date.getTime())?rows[index].date:
        new Intl.DateTimeFormat("fa-IR-u-ca-persian",{day:"numeric",month:"short",timeZone:"Asia/Tehran"}).format(date);
      labels.appendChild(span);
    });
  }
  function renderArticleAnalytics() {
    const data=state.articleAnalytics;
    const list=$("#article-analytics-results");
    const summary=$("#article-analytics-summary");
    if(!list||!summary)return;
    list.replaceChildren();summary.replaceChildren();
    if(!data||!Array.isArray(data.articles)){
      $("#article-analytics-empty").hidden=false;
      $("#article-analytics-empty").textContent=data?.message||"ساختار گزارش از سرور دریافت نشد.";
      renderArticleAnalyticsChart([]);
      return;
    }
    const articles=data.articles;
    const ga4Ok=data.ga4?.status==="ok";
    const gscOk=data.searchConsole?.status==="ok";
    const landingOk=data.sources?.status==="ok";
    const total=(key,source)=>articles.reduce((sum,item)=>sum+Number(item[source]?.[key]||0),0);
    summary.append(
      analyticsMetric("بازدید صفحات",ga4Ok?formatMetric(total("pageViews","ga4")):"—"),
      analyticsMetric("نشست‌های ورودی به مقاله‌ها",landingOk?formatMetric(data.sources.articleLandingSessions):"—"),
      analyticsMetric("کلیک از گوگل",gscOk?formatMetric(total("clicks","searchConsole")):"—"),
      analyticsMetric("نمایش در گوگل",gscOk?formatMetric(total("impressions","searchConsole")):"—")
    );
    const reportPeriod="GA4: "+(data.periods?.ga4||"۳۰ روز اخیر")+" · Search Console: "+
      ((data.periods?.searchConsole?.startDate&&data.periods?.searchConsole?.endDate)
        ? data.periods.searchConsole.startDate+" تا "+data.periods.searchConsole.endDate
        : "بازه در دسترس نیست");
    const note=$("#article-analytics-status");
    const states=[];
    states.push(ga4Ok?"GA4 متصل":"GA4: "+(data.ga4?.message||"گزارش در دسترس نیست"));
    states.push(gscOk?"Search Console متصل":(data.searchConsole?.message||"Search Console داده‌ای برنگردوند."));
    if(data.historyStatus==="error")states.push("نمودار: "+(data.historyMessage||"در دسترس نیست"));
    else if(data.historyStatus==="no_data")states.push("برای نمودار داده‌ای نیست");
    note.textContent=(data.message?data.message+" · ":"")+reportPeriod+" · "+states.join(" · ")+" · آخرین دریافت: "+
      new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Tehran"}).format(new Date(data.generatedAt||Date.now()));
    renderArticleAnalyticsChart(data.history);
    const needle=($("#article-analytics-search")?.value||"").trim().toLocaleLowerCase();
    const filtered=articles.filter((article)=>!needle||[article.title,article.slug].join(" ").toLocaleLowerCase().includes(needle));
    $("#article-analytics-empty").hidden=filtered.length>0;
    if(!filtered.length){
      $("#article-analytics-empty").textContent=needle?"برای این جست‌وجو مقاله‌ای پیدا نشد.":(data.message||"در این بازه مقاله‌ای برای نمایش وجود نداره.");
    }
    filtered.forEach((article)=>{
      const card=document.createElement("article");card.className="article-analytics-card";
      const heading=document.createElement("div");heading.className="article-analytics-heading";
      const main=document.createElement("div");main.className="article-analytics-main";
      const title=document.createElement("a");title.className="article-analytics-title";
      title.href="/blog/"+encodeURIComponent(article.slug)+"/";title.target="_blank";title.rel="noopener noreferrer";
      title.textContent=article.title||article.slug;
      const slug=document.createElement("span");slug.className="article-analytics-slug";slug.textContent="/blog/"+article.slug+"/";
      main.append(title,slug);
      const published=document.createElement("time");published.className="article-analytics-published";
      published.dateTime=article.publishedAt||"";
      published.textContent=article.publishedAt?dateLabel(article.publishedAt):"تاریخ انتشار نامشخص";
      heading.append(main,published);
      const groups=document.createElement("div");groups.className="article-analytics-groups";
      const gaGroup=document.createElement("section");gaGroup.className="article-analytics-group";
      const gaTitle=document.createElement("h3");gaTitle.textContent="Google Analytics";
      const gaMetrics=document.createElement("div");gaMetrics.className="article-analytics-metrics";
      const ga=article.ga4||{};
      gaMetrics.append(
        analyticsMetric("بازدید صفحه",ga.status==="ok"?formatMetric(ga.pageViews):"—"),
        analyticsMetric("کاربران",ga.status==="ok"?formatMetric(ga.users):"—"),
        analyticsMetric("نشست‌های صفحه",ga.status==="ok"?formatMetric(ga.sessions):"—"),
        analyticsMetric("نشست‌های ورودی",ga.sourcesStatus==="ok"?formatMetric(ga.landingSessions):"—")
      );
      gaGroup.append(gaTitle,gaMetrics);
      const gscGroup=document.createElement("section");gscGroup.className="article-analytics-group";
      const gscTitle=document.createElement("h3");gscTitle.textContent="Google Search Console";
      const gscMetrics=document.createElement("div");gscMetrics.className="article-analytics-metrics";
      const sc=article.searchConsole||{};
      gscMetrics.append(
        analyticsMetric("کلیک",sc.status==="ok"?formatMetric(sc.clicks):"—"),
        analyticsMetric("نمایش",sc.status==="ok"?formatMetric(sc.impressions):"—"),
        analyticsMetric("CTR",sc.status==="ok"?(Number(sc.ctr||0)*100).toLocaleString("fa-IR",{maximumFractionDigits:1})+"٪":"—"),
        analyticsMetric("میانگین جایگاه",sc.status==="ok"&&Number(sc.impressions||0)>0?Number(sc.position||0).toLocaleString("fa-IR",{maximumFractionDigits:1}):"—")
      );
      gscGroup.append(gscTitle,gscMetrics);
      groups.append(gaGroup,gscGroup);
      const sourceBlock=document.createElement("div");sourceBlock.className="article-analytics-sources";
      const sourceTitle=document.createElement("strong");sourceTitle.textContent="منابع و رسانه‌های ورودی";
      const sourceList=document.createElement("div");sourceList.className="article-analytics-source-list";
      if(ga.sourcesStatus==="ok"&&Array.isArray(ga.sources)&&ga.sources.length){
        ga.sources.forEach((source)=>{
          const item=document.createElement("span");
          item.textContent=String(source.sourceMedium||"(not set)")+" · "+formatMetric(source.sessions)+" نشست";
          sourceList.appendChild(item);
        });
      }else{
        const emptySource=document.createElement("span");
        emptySource.textContent=ga.sourcesStatus==="error"?"گزارش منابع ورودی در دسترس نیست.":"هنوز منبع ورودیِ تفکیک‌شده‌ای ثبت نشده.";
        sourceList.appendChild(emptySource);
      }
      sourceBlock.append(sourceTitle,sourceList);
      card.append(heading,groups,sourceBlock);
      list.appendChild(card);
    });
  }
  async function loadArticleAnalytics(force,silent=false) {
    const refreshInterval=60*60*1000;
    if(state.analyticsBusy)return;
    if(state.articleAnalytics&&!force){
      renderArticleAnalytics();
      if(Date.now()-state.analyticsLastFetchedAt>=refreshInterval)void loadArticleAnalytics(true,true);
      return;
    }
    state.analyticsBusy=true;
    const requestEpoch=state.analyticsEpoch;
    const button=$("#refresh-article-analytics");
    if(!silent){
      setButton(button,true,"در حال دریافت…");
      $("#article-analytics-status").textContent="در حال دریافت و تطبیق گزارش‌های GA4 و Search Console…";
    }
    try{
      const report=await siteAnalytics("articles");
      if(requestEpoch!==state.analyticsEpoch)return;
      state.articleAnalytics=report;
      state.analyticsLastFetchedAt=Date.now();
      renderArticleAnalytics();
      if(!silent&&state.articleAnalytics.status==="error")toast("بخشی از گزارش‌های آمار مقاله‌ها در دسترس نیست.",true);
    }catch(error){
      if(requestEpoch!==state.analyticsEpoch)return;
      state.analyticsLastFetchedAt=Date.now();
      $("#article-analytics-status").textContent=error.message;
      if(!silent)toast(error.message,true);
    }finally{
      if(requestEpoch===state.analyticsEpoch){
        state.analyticsBusy=false;
        if(!silent)setButton(button,false);
      }
    }
  }
  const newPost=()=>({
    id:"",slug:"",title:"",excerpt:"",content:"",language:"fa",category:"",categories:[],primary_category:"",tags:[],
    hero_image_url:"",hero_image_alt:"",hero_image_caption:"",og_image_url:"",
    seo_title:"",meta_description:"",focus_keyword:"",canonical_url:"",og_title:"",og_description:"",
    robots_index:true,robots_follow:true,featured:false,toc_enabled:true,drop_cap:false,
    content_width:"reading",accent_color:"#a86f54",faqs:[],status:"draft",has_unpublished_changes:false,
  });
  function showEditor(post) {
    state.currentPost={...newPost(),...(post||{})};
    state.editorChangeVersion=0;
    clearEditorDirty();
    state.preview=false;$("#editor-form").reset();fillEditor(state.currentPost);
    showView("editor");updatePreview();updateSeo();updateEditorStatus();
    $("#markdown-preview").hidden=true;$("#post-content").hidden=false;
    $("#link-settings").hidden=true;refreshLinkManager();
    showTab("seo");
  }
  function newArticle(){if(!confirmLeaveEditor())return;showEditor(newPost());}
  function setField(selector,value){const field=$(selector);if(!field)return;if(field.type==="checkbox")field.checked=value!==false;else field.value=value??"";}
  function fillEditor(post) {
    const fields={
      "#post-title":"title","#post-slug":"slug","#post-excerpt":"excerpt","#post-language":"language",
      "#post-hero-url":"hero_image_url",
      "#post-hero-alt":"hero_image_alt","#post-hero-caption":"hero_image_caption","#post-og-url":"og_image_url",
      "#post-seo-title":"seo_title","#post-meta-description":"meta_description","#post-focus-keyword":"focus_keyword",
      "#post-canonical":"canonical_url","#post-og-title":"og_title","#post-og-description":"og_description",
      "#post-robots-index":"robots_index","#post-featured":"featured",
      "#post-toc":"toc_enabled","#post-dropcap":"drop_cap","#post-width":"content_width","#post-accent":"accent_color",
    };
    Object.entries(fields).forEach(([selector,key])=>setField(selector,post[key]));
    renderPostCategoryControls(post.categories,post.primary_category||post.category||"");
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
    post.robots_follow=true;
    post.content=editorToMarkdown($("#post-content"));
    post.categories=selectedEditorCategories();
    post.primary_category=post.categories.includes($("#post-primary-category").value)
      ? $("#post-primary-category").value
      : (post.categories[0]||"");
    post.category=post.primary_category;
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
    if(!confirmLeaveEditor())return;
    try{const result=await api("get_post",{id});showEditor(result.post);}
    catch(error){toast(error.message,true);}
  }
  function showTab(name,focus=false) {
    document.querySelectorAll(".editor-tab").forEach((button)=>{
      const active=button.dataset.tab===name;
      button.classList.toggle("active",active);
      button.setAttribute("aria-selected",active?"true":"false");
      button.tabIndex=active?0:-1;
      if(active&&focus)button.focus();
    });
    document.querySelectorAll(".tab-panel").forEach((panel)=>{
      const active=panel.id==="tab-"+name;
      panel.hidden=!active;
      panel.classList.toggle("active",active);
    });
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function safeHref(raw) {
    const value=String(raw||"").trim();
    if(!value)return "#";
    if(value.startsWith("#"))return value;
    if(value.startsWith("/")&&value[1]!=="/"&&value[1]!==String.fromCharCode(92))return value;
    try{
      const url=new URL(value);
      if(["http:","https:","mailto:"].includes(url.protocol)&&!url.username&&!url.password)return value;
    }catch{}
    return "#";
  }
  function unescapeMarkdownAttribute(value) {
    return String(value||"").replace(/\\([\\\]"])/g,"$1");
  }
  function parsePreviewImageLine(line) {
    const match=String(line||"").trim().match(/^!\[((?:\\.|[^\]])*)\]\(([^)\s]+)(?:\s+"((?:\\.|[^"])*)")?\)(?:\s+\{caption="((?:\\.|[^"])*)"\})?$/);
    if(!match)return null;
    const src=safeHref(unescapeMarkdownAttribute(match[2]).replace(/&amp;/g,"&"));
    if(src==="#")return null;
    return {
      src,
      alt:unescapeMarkdownAttribute(match[1]),
      title:unescapeMarkdownAttribute(match[3]||""),
      caption:unescapeMarkdownAttribute(match[4]||"")
    };
  }
  function renderPreviewFigure(line) {
    const image=parsePreviewImageLine(line);
    if(!image)return "";
    return '<figure class="blog-inline-image"><img src="'+escapeHtml(image.src)+'" alt="'+escapeHtml(image.alt)+'"'+(image.title?' title="'+escapeHtml(image.title)+'"':"")+' loading="lazy" decoding="async">'+(image.caption?'<figcaption>'+escapeHtml(image.caption)+'</figcaption>':"")+"</figure>";
  }
  function previewInline(text) {
    let value=escapeHtml(text);
    value=value.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,(_m,alt,url,title)=>'<img src="'+escapeHtml(safeHref(url.replace(/&amp;/g,"&")))+'" alt="'+alt+'"'+(title?' title="'+title+'"':"")+' loading="lazy" decoding="async">');
    value=value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(?:\{([^}]*)\})?/g,(_m,label,url,title,options)=>{
      const href=safeHref(url.replace(/&amp;/g,"&")),external=/^https?:\/\//i.test(href);
      const relation=(String(options||"").match(/rel=(follow|nofollow|sponsored|ugc)/i)||[])[1]||(external?"nofollow":"follow");
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
    const output=[],paragraph=[],listStack=[];
    const close=()=>{if(paragraph.length)output.push("<p>"+previewInline(paragraph.join(" "))+"</p>");paragraph.length=0;};
    const closeList=(keepDepth=0)=>{
      while(listStack.length>keepDepth){
        const current=listStack.pop();
        if(current.itemOpen)output.push("</li>");
        output.push("</"+current.type+">");
      }
    };
    const parseListItem=(line)=>{
      const match=String(line||"").match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
      if(!match)return null;
      const indent=match[1].replace(/\t/g,"  ").length;
      return {depth:Math.floor(indent/2),type:/^\d/.test(match[2])?"ol":"ul",content:match[3]};
    };
    const appendListItem=(item)=>{
      let depth=item.depth;
      if(!listStack.length)depth=0;
      while(listStack.length&&depth<listStack[listStack.length-1].depth)closeList(listStack.length-1);
      if(!listStack.length)depth=0;
      let current=listStack[listStack.length-1];
      if(!current){
        output.push("<"+item.type+">");
        listStack.push({type:item.type,depth,itemOpen:false});
        current=listStack[listStack.length-1];
      }else if(depth>current.depth){
        if(!current.itemOpen){output.push("<li>");current.itemOpen=true;}
        output.push("<"+item.type+">");
        listStack.push({type:item.type,depth:current.depth+1,itemOpen:false});
        current=listStack[listStack.length-1];
      }else if(current.type!==item.type){
        closeList(listStack.length-1);
        output.push("<"+item.type+">");
        listStack.push({type:item.type,depth,itemOpen:false});
        current=listStack[listStack.length-1];
      }else if(current.itemOpen){
        output.push("</li>");
        current.itemOpen=false;
      }
      output.push("<li>"+previewInline(item.content));
      current.itemOpen=true;
    };
    const lines=String(markdown||"").replace(/\r\n/g,"\n").split("\n");
    for(let index=0;index<lines.length;index++){
      const line=lines[index];
      if(/^\x60{3}/.test(line)){
        close();closeList();
        const code=[];
        while(index+1<lines.length&&!/^\x60{3}/.test(lines[index+1]))code.push(lines[++index]);
        if(index+1<lines.length)index++;
        output.push("<pre><code>"+escapeHtml(code.join("\n"))+"</code></pre>");
        continue;
      }
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
      if(!line.trim()){
        close();
        if(!parseListItem(lines[index+1]||""))closeList();
        continue;
      }
      const image=renderPreviewFigure(line);
      if(image){close();closeList();output.push(image);continue;}
      if(line.trim()&&index+1<lines.length){
        const setext=lines[index+1].trim().match(/^(={3,}|-{3,})$/);
        if(setext){close();closeList();const level=setext[1][0]==="="?2:3;output.push("<h"+level+">"+previewInline(line.trim())+"</h"+level+">");index++;continue;}
      }
      const heading=line.match(/^\s{0,3}(#{1,4})\s+(.+)$/);
      if(heading){close();closeList();const level=Math.max(2,heading[1].length);output.push("<h"+level+">"+previewInline(heading[2])+"</h"+level+">");continue;}
      const quote=line.match(/^>\s?(.*)$/);
      if(quote){close();closeList();output.push("<blockquote><p>"+previewInline(quote[1])+"</p></blockquote>");continue;}
      const item=parseListItem(line);
      if(item){close();appendListItem(item);continue;}
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
      if(src==="#")return "";
      const alt=String(element.getAttribute("alt")||"").replace(/\\/g,"\\\\").replace(/]/g,"\\]");
      const title=String(element.getAttribute("title")||"").trim().replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/[\r\n]+/g," ");
      return "!["+alt+"]("+src+(title?' "'+title+'"':"")+")";
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
      const explicitRelation=element.dataset.linkRel;
      const relation=explicitRelation||((element.getAttribute("rel")||"").split(/\s+/).find((v)=>["nofollow","sponsored","ugc"].includes(v))||(external?"nofollow":"follow"));
      const target=element.dataset.linkTarget||element.getAttribute("target")||(external?"_blank":"_self");
      const options=[];
      if(relation!=="follow"||explicitRelation==="follow")options.push("rel="+relation);
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
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue?.trim()?node.nodeValue.trim()+"\n\n":"";
    if(node.nodeType!==Node.ELEMENT_NODE)return "";
    const element=node,tag=element.tagName.toLowerCase();
    if(tag==="figure"){
      const image=element.querySelector("img");
      if(!image)return "";
      const src=safeHref(image.getAttribute("src"));
      if(src==="#")return "";
      const escapeAttribute=(value)=>String(value||"").replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/[\r\n]+/g," ");
      const alt=String(image.getAttribute("alt")||"").replace(/\\/g,"\\\\").replace(/]/g,"\\]");
      const title=escapeAttribute(image.getAttribute("title")||"");
      const caption=escapeAttribute(element.querySelector("figcaption")?.textContent||"");
      return "!["+alt+"]("+src+(title?' "'+title+'"':"")+")"+(caption?' {caption="'+caption+'"}':"")+"\n\n";
    }
    if(/^h[1-6]$/.test(tag))return "#".repeat(tag==="h1"?2:Math.min(4,Math.max(2,Number(tag.slice(1)))))+" "+Array.from(element.childNodes).map(inlineToMarkdown).join("").trim()+"\n\n";
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
  function clipboardHeadingLevel(source) {
    const tag=source.tagName?.toLowerCase()||"";
    if(/^h[1-6]$/.test(tag))return Math.min(4,Math.max(2,Number(tag.slice(1))+1));
    const role=source.getAttribute("role")==="heading";
    const ariaLevel=Number(source.getAttribute("aria-level")||source.getAttribute("data-heading-level")||0);
    if(role&&ariaLevel>=1&&ariaLevel<=6)return Math.min(4,Math.max(2,ariaLevel+1));
    const classes=String(source.getAttribute("class")||"").toLowerCase();
    if(/mso(title|heading1)|heading[_ -]?1|title[_ -]?1/.test(classes))return 2;
    if(/mso(subtitle|heading2)|heading[_ -]?2|subtitle/.test(classes))return 3;
    if(/heading[_ -]?3/.test(classes))return 4;
    // Only inspect styles declared on this block. Inline bold runs stay inline.
    const style=(source.getAttribute("style")||"").toLowerCase();
    const size=(style.match(/font-size\s*:\s*([0-9.]+)(px|pt|em|rem)?/)||[]);
    let largest=0;
    if(size[1]){
      let value=Number(size[1]),unit=size[2]||"px";
      if(unit==="pt")value*=4/3;
      if(unit==="em"||unit==="rem")value*=16;
      largest=value;
    }
    const bold=/font-weight\s*:\s*(bold|[6-9]00)/.test(style);
    if(!bold)return 0;
    if(largest>=30)return 2;
    if(largest>=25)return 3;
    if(largest>=20)return 4;
    return 0;
  }
  function cleanClipboardNode(node) {
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue||"");
    if(node.nodeType!==Node.ELEMENT_NODE)return null;
    const source=node,tag=source.tagName.toLowerCase();
    if(["script","style","iframe","object","embed","svg","meta","link"].includes(tag))return null;
    const children=()=>Array.from(source.childNodes).map(cleanClipboardNode).filter(Boolean);
    const style=(source.getAttribute("style")||"").toLowerCase();
    if((tag==="b"||tag==="strong")&&/font-weight\s*:\s*(normal|[1-5]00)\b/.test(style)){
      const fragment=document.createDocumentFragment();children().forEach((child)=>fragment.appendChild(child));return fragment;
    }
    if(["p","div"].includes(tag)){
      const level=clipboardHeadingLevel(source);
      if(level){
        const heading=document.createElement("h"+level);
        children().forEach((child)=>heading.appendChild(child));
        return heading;
      }
    }
    if(tag==="span"||tag==="font"){
      let fragment=document.createDocumentFragment();children().forEach((child)=>fragment.appendChild(child));
      if(/font-weight\s*:\s*(bold|[6-9]00)/.test(style)){const strong=document.createElement("strong");strong.append(fragment);fragment=strong;}
      if(/font-style\s*:\s*italic/.test(style)){const em=document.createElement("em");em.append(fragment);fragment=em;}
      if(/text-decoration[^;]*underline/.test(style)){const underline=document.createElement("u");underline.append(fragment);fragment=underline;}
      return fragment;
    }
    const tags={b:"strong",strong:"strong",i:"em",em:"em",u:"u",s:"del",strike:"del",del:"del",h1:"h2",h2:"h2",h3:"h3",h4:"h4",h5:"h4",h6:"h4"};
    const allowed=new Set(["p","div","figure","figcaption","img","h2","h3","h4","ul","ol","li","blockquote","br","hr","pre","code","table","thead","tbody","tfoot","tr","th","td","strong","em","u","del","a"]);
    const outputTag=tags[tag]||tag;
    if(tag==="img"){
      const src=safeHref(source.getAttribute("src"));
      if(src==="#")return null;
      const cleanImage=document.createElement("img");
      cleanImage.setAttribute("src",src);
      cleanImage.setAttribute("alt",source.getAttribute("alt")||"");
      const title=source.getAttribute("title");
      if(title)cleanImage.setAttribute("title",title.slice(0,160));
      cleanImage.setAttribute("loading","lazy");
      cleanImage.setAttribute("decoding","async");
      return cleanImage;
    }
    if(!allowed.has(outputTag)){
      const fragment=document.createDocumentFragment();children().forEach((child)=>fragment.appendChild(child));return fragment;
    }
    const clean=document.createElement(outputTag);
    if(tag==="a"){
      const href=safeHref(source.getAttribute("href"));
      if(href==="#"){const fragment=document.createDocumentFragment();children().forEach((child)=>fragment.appendChild(child));return fragment;}
      clean.setAttribute("href",href);
      const external=/^https?:\/\//i.test(href);
      const rel=(source.getAttribute("rel")||"").split(/\s+/).find((value)=>["follow","nofollow","sponsored","ugc"].includes(value))||(external?"nofollow":"follow");
      const target=source.getAttribute("target")==="_self"?"_self":source.getAttribute("target")==="_blank"?"_blank":(external?"_blank":"_self");
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
      [["follow","عادی · دنبال‌شونده"],["nofollow","دنبال‌نشونده"],["sponsored","تبلیغاتی"],["ugc","محتوای کاربر"]].forEach(([value,title])=>{const option=document.createElement("option");option.value=value;option.textContent=title;relation.appendChild(option);});
      relation.value=anchor.dataset.linkRel||((anchor.rel||"").split(/\s+/).find((v)=>["nofollow","sponsored","ugc"].includes(v))||(/^https?:\/\//i.test(anchor.href)?"nofollow":"follow"));
      relation.addEventListener("change",()=>{anchor.dataset.linkRel=relation.value;anchor.rel=[...(relation.value==="follow"?[]:[relation.value]),...(anchor.target==="_blank"?["noopener","noreferrer"]:[])].join(" ");markEditorDirty();updatePreview();updateSeo();});
      const targetLabel=document.createElement("label");targetLabel.textContent="بازشدن";
      const target=document.createElement("select");target.setAttribute("aria-label","نحوۀ بازشدن "+(anchor.textContent||"پیوند "+(index+1)));
      [["auto","پیش‌فرض"],["_self","همین زبانه"],["_blank","زبانه جدید"]].forEach(([value,title])=>{const option=document.createElement("option");option.value=value;option.textContent=title;target.appendChild(option);});
      target.value=anchor.dataset.linkTarget||anchor.target||"auto";
      target.addEventListener("change",()=>{const external=/^https?:\/\//i.test(anchor.href);const value=target.value==="auto"?(external?"_blank":"_self"):target.value;anchor.dataset.linkTarget=value;if(value==="_self")anchor.setAttribute("target","_self");else anchor.setAttribute("target","_blank");const rel=anchor.dataset.linkRel||"follow";anchor.rel=[...(rel==="follow"?[]:[rel]),...(value==="_blank"?["noopener","noreferrer"]:[])].join(" ");markEditorDirty();updatePreview();updateSeo();});
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
    const external=/^https?:\/\//i.test(href),relation=external?"nofollow":"follow",target=external?"_blank":"_self";
    if(selected){document.execCommand("createLink",false,href);}
    else{
      const label=window.prompt("متن نمایشی پیوند را وارد کن:","مشاهدۀ منبع");
      if(!label)return;
      insertHtmlAtCaret('<a href="'+escapeHtml(href)+'" target="'+target+'" data-link-rel="'+relation+'" data-link-target="'+target+'"'+(external?' rel="nofollow noopener noreferrer"':'')+'>'+escapeHtml(label)+"</a>");
      markEditorDirty();
      updatePreview();updateSeo();refreshLinkManager();
      return;
    }
    const selection=window.getSelection(),node=selection?.anchorNode;
    const anchor=node instanceof Element?node.closest("a"):node?.parentElement?.closest("a");
    if(anchor){
      anchor.dataset.linkRel=relation;anchor.dataset.linkTarget=target;
      anchor.setAttribute("target",target);
      anchor.rel=[...(relation==="follow"?[]:[relation]),...(target==="_blank"?["noopener","noreferrer"]:[])].join(" ");
    }
    markEditorDirty();
    updatePreview();updateSeo();refreshLinkManager();
  }
  function currentEditorBlock() {
    const editor=$("#post-content"),selection=window.getSelection();
    if(!selection||!selection.rangeCount||!editor.contains(selection.anchorNode))return null;
    let node=selection.anchorNode;
    if(node.nodeType===Node.TEXT_NODE)node=node.parentElement;
    return node instanceof Element?node.closest("h2,h3,h4,blockquote,li,p,div"):null;
  }
  function getSelectedBlockquote() {
    const editor=$("#post-content"),selection=window.getSelection();
    if(!selection||!selection.rangeCount)return null;
    const nodes=[selection.anchorNode,selection.focusNode];
    for(let node of nodes){
      if(node?.nodeType===Node.TEXT_NODE)node=node.parentElement;
      const quote=node instanceof Element?node.closest("blockquote"):null;
      if(quote&&editor.contains(quote))return quote;
    }
    return null;
  }
  function unwrapBlockquote(quote) {
    const fragment=document.createDocumentFragment();
    const children=Array.from(quote.childNodes);
    children.forEach((child)=>{
      if(child.nodeType===Node.ELEMENT_NODE&&["P","DIV"].includes(child.tagName)){
        fragment.appendChild(child);
      }else if(child.nodeType===Node.TEXT_NODE&&!child.textContent.trim()){
        return;
      }else{
        const paragraph=document.createElement("p");paragraph.appendChild(child);fragment.appendChild(paragraph);
      }
    });
    if(!fragment.childNodes.length){const paragraph=document.createElement("p");paragraph.appendChild(document.createElement("br"));fragment.appendChild(paragraph);}
    quote.replaceWith(fragment);
  }
  function updateFormatToolbar() {
    const editor=$("#post-content");
    if(!editor||!editor.isConnected)return;
    const block=currentEditorBlock();
    const blockName=block?.tagName?.toLowerCase()||"";
    document.querySelectorAll(".format-tools [data-command]").forEach((button)=>{
      const command=button.dataset.command,value=(button.dataset.value||"").toLowerCase();
      let active=false;
      try{
        if(command==="formatBlock")active=value==="blockquote"?Boolean(getSelectedBlockquote()):blockName===value;
        else active=document.queryCommandState(command);
      }catch{}
      button.classList.toggle("is-active",Boolean(active));
      button.setAttribute("aria-pressed",active?"true":"false");
    });
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
      {label:"متن جایگزین برای همۀ تصاویر درون‌متنی",pass:Array.from($("#post-content").querySelectorAll("img")).every((image)=>!!image.alt.trim())},
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
  async function savePost(options={}) {
    if(state.postSaveBusy)throw new Error("ذخیرۀ مقاله در حال انجامه؛ کمی صبر کن.");
    const submittedVersion=state.editorChangeVersion;
    state.postSaveBusy=true;
    const buttons=["#save-post","#sidebar-save"].map((selector)=>$(selector));
    buttons.forEach((button)=>setButton(button,true,"در حال ذخیره…"));
    try{
      const post=collectPost();
      const result=await api("save_post",{post});
      state.currentPost=result.post;
      if(state.editorChangeVersion===submittedVersion)clearEditorDirty();
      else updateEditorDirtyIndicator();
      await loadPosts();updateEditorStatus();
      if(options.silent!==true)toast("پیش‌نویس ذخیره شد.");
      return result.post;
    }finally{
      state.postSaveBusy=false;
      buttons.forEach((button)=>setButton(button,false));
    }
  }
  async function publishPost() {
    if(state.publishBusy)return;
    state.publishBusy=true;
    const buttons=["#publish-post","#sidebar-publish"].map((selector)=>$(selector));
    buttons.forEach((button)=>setButton(button,true,"در حال انتشار…"));
    try{
      const post=await savePost({silent:true});
      const result=await api("publish_post",{id:post.id});
      state.currentPost=result.post;await loadPosts();updateEditorStatus();
      toast("درخواست انتشار ثبت شد؛ بعد از Build مقاله و سایت‌مپ به‌روز می‌شن.");
    }finally{
      state.publishBusy=false;
      buttons.forEach((button)=>setButton(button,false));
    }
  }
  async function changeStatus(action) {
    const post=state.currentPost;if(!post?.id||state.statusBusy)return;
    if(state.editorDirty){toast("ابتدا تغییرات مقاله رو ذخیره کن؛ بعد وضعیت انتشار رو تغییر بده.",true);return;}
    if(!window.confirm(action==="archive_post"?"این مقاله به بایگانی منتقل بشه؟":"این مقاله از وبلاگ عمومی خارج بشه؟"))return;
    state.statusBusy=true;
    const buttons=["#unpublish-post","#archive-post"].map((selector)=>$(selector));
    buttons.forEach((button)=>setButton(button,true,"در حال انجام…"));
    try{
      const result=await api(action,{id:post.id});state.currentPost=result.post;await loadPosts();updateEditorStatus();
      toast(action==="archive_post"?"مقاله بایگانی شد.":"مقاله از انتشار خارج شد.");
    }finally{
      state.statusBusy=false;
      buttons.forEach((button)=>setButton(button,false));
    }
  }
  function canvasBlob(canvas,type,quality) {
    return new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error("تبدیل تصویر ناموفق بود.")),type,quality));
  }
  async function compressImage(file) {
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("فقط تصویر JPG، PNG یا WebP قابل فشرده‌سازی است.");
    const bitmap=await createImageBitmap(file);
    const canvas=document.createElement("canvas");
    // Keep the original pixel dimensions and aspect ratio; only change encoding quality.
    canvas.width=bitmap.width;
    canvas.height=bitmap.height;
    const context=canvas.getContext("2d",{alpha:false});
    if(!context){bitmap.close();throw new Error("مرورگر امکان فشرده‌سازی تصویر رو فراهم نکرد.");}
    context.fillStyle="#f4f1e9";context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    let blob=await canvasBlob(canvas,"image/webp",0.88);
    for(const quality of [0.82,0.76,0.7,0.64,0.58,0.52,0.46]){
      if(blob.size<=3*1024*1024)break;
      blob=await canvasBlob(canvas,"image/webp",quality);
    }
    if(blob.size>3*1024*1024)throw new Error("تصویر با حفظ ابعاد اصلی، پس از فشرده‌سازی هم بیشتر از ۳ مگابایته. لطفاً نسخۀ کم‌حجم‌تری انتخاب کن.");
    return blob;
  }
  async function uploadImage(file) {
    let blob,filename;
    if(file.type==="image/gif"){
      if(file.size<=0||file.size>3*1024*1024)throw new Error("برای حفظ انیمیشن GIF، حجم فایل باید حداکثر ۳ مگابایت باشه.");
      blob=file;
      filename=(file.name||"animated-banner.gif").toLowerCase().endsWith(".gif")?file.name:"animated-banner.gif";
      toast("در حال بارگذاری GIF متحرک…");
    }else{
      toast("در حال بهینه‌سازی تصویر…");
      blob=await compressImage(file);
      filename="blog-image.webp";
    }
    const form=new FormData();form.append("action","upload_image");form.append("file",blob,filename);
    const result=await uploadRequest(form,false);
    return result.url;
  }
  async function handleImage(inputId,urlId,previewId,altSelector) {
    const input=$("#"+inputId),file=input.files?.[0];if(!file)return;
    try {
      input.disabled=true;
      const url=await uploadImage(file);$("#"+urlId).value=url;
      updateImagePreview(previewId,url,$(altSelector)?.value||"");
      markEditorDirty();
      toast("تصویر فشرده و بارگذاری شد.");
      updateSeo();
    } catch(error) {toast(error.message,true);}
    finally {input.disabled=false;input.value="";}
  }
  let pendingInlineImageFile=null;
  let pendingInlineImageObjectUrl="";
  let pendingInlineImageRange=null;
  let editingInlineImageFigure=null;

  function beginInlineImageInsert() {
    const editor=$("#post-content"),selection=window.getSelection();
    pendingInlineImageRange=selection?.rangeCount&&editor.contains(selection.anchorNode)?selection.getRangeAt(0).cloneRange():null;
    $("#inline-image-file").click();
  }
  function openInlineImageDialog(file,figure) {
    const dialog=$("#inline-image-dialog");
    pendingInlineImageFile=file||null;
    editingInlineImageFigure=figure||null;
    if(pendingInlineImageObjectUrl){URL.revokeObjectURL(pendingInlineImageObjectUrl);pendingInlineImageObjectUrl="";}
    const image=figure?.querySelector("img")||null;
    const preview=$("#inline-image-dialog-preview");
    if(file){
      pendingInlineImageObjectUrl=URL.createObjectURL(file);
      preview.src=pendingInlineImageObjectUrl;
      $("#inline-image-alt").value="";
      $("#inline-image-title").value="";
      $("#inline-image-caption").value="";
    }else if(image){
      preview.src=image.src;
      $("#inline-image-alt").value=image.alt||"";
      $("#inline-image-title").value=image.title||"";
      $("#inline-image-caption").value=figure.querySelector("figcaption")?.textContent||"";
    }
    dialog.showModal();
    $("#inline-image-alt").focus();
  }
  function closeInlineImageDialog() {
    const dialog=$("#inline-image-dialog");
    if(dialog.open)dialog.close();
    if(pendingInlineImageObjectUrl){URL.revokeObjectURL(pendingInlineImageObjectUrl);pendingInlineImageObjectUrl="";}
    pendingInlineImageFile=null;
    editingInlineImageFigure=null;
    $("#inline-image-form").reset();
    $("#inline-image-dialog-preview").removeAttribute("src");
  }
  function createInlineImageFigure(url,alt,title,caption) {
    const figure=document.createElement("figure");
    figure.className="blog-inline-image";
    figure.dataset.inlineImage="true";
    const image=document.createElement("img");
    image.src=url;image.alt=alt;image.loading="lazy";image.decoding="async";
    if(title)image.title=title;
    figure.appendChild(image);
    if(caption){const figcaption=document.createElement("figcaption");figcaption.textContent=caption;figure.appendChild(figcaption);}
    return figure;
  }
  function placeInlineImageFigure(figure) {
    const editor=$("#post-content");
    let block=null;
    if(pendingInlineImageRange&&editor.contains(pendingInlineImageRange.commonAncestorContainer)){
      let node=pendingInlineImageRange.startContainer;
      if(node.nodeType===Node.TEXT_NODE)node=node.parentElement;
      block=node instanceof Element?node.closest("p,h2,h3,h4,blockquote,ul,ol,li"):null;
    }
    if(block?.tagName==="LI")block=block.closest("ul,ol")||block;
    if(block&&block!==editor)block.after(figure);
    else editor.appendChild(figure);
    const spacer=document.createElement("p");
    spacer.appendChild(document.createElement("br"));
    figure.after(spacer);
    const range=document.createRange();
    range.selectNodeContents(spacer);
    range.collapse(true);
    const selection=window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    pendingInlineImageRange=null;
    updatePreview();updateSeo();refreshLinkManager();
  }
  async function saveInlineImage(event) {
    event.preventDefault();
    const alt=$("#inline-image-alt").value.trim();
    if(!alt){$("#inline-image-alt").focus();toast("برای تصویر، متن جایگزین توصیفی وارد کن.",true);return;}
    const title=$("#inline-image-title").value.trim();
    const caption=$("#inline-image-caption").value.trim();
    const button=$("#inline-image-submit");
    setButton(button,true,"در حال درج…");
    try{
      if(editingInlineImageFigure){
        const image=editingInlineImageFigure.querySelector("img");
        image.alt=alt;
        if(title)image.title=title;else image.removeAttribute("title");
        const previous=editingInlineImageFigure.querySelector("figcaption");
        if(caption){
          const figcaption=previous||document.createElement("figcaption");
          figcaption.textContent=caption;
          if(!previous)editingInlineImageFigure.appendChild(figcaption);
        }else if(previous)previous.remove();
      }else{
        if(!pendingInlineImageFile)throw new Error("تصویری برای درج انتخاب نشده.");
        const url=await uploadImage(pendingInlineImageFile);
        placeInlineImageFigure(createInlineImageFigure(url,alt,title,caption));
        toast("تصویر فشرده و به متن مقاله اضافه شد.");
      }
      closeInlineImageDialog();
      markEditorDirty();
      updatePreview();updateSeo();
    }catch(error){
      toast(error instanceof Error?error.message:"درج تصویر ناموفق بود.",true);
    }finally{
      setButton(button,false);
    }
  }
  function postCategorySlugs(post) {
    const values=Array.isArray(post?.categories)&&post.categories.length
      ? post.categories
      : [post?.primary_category||post?.category||""];
    return [...new Set(values.map((value)=>String(value||"").trim()).filter(Boolean))].slice(0,3);
  }
  function getConfiguredCategories(settings) {
    const source=Array.isArray(settings?.categories)?settings.categories:[];
    const result=source.map((item)=>({slug:String(item?.slug||""),name:String(item?.name||"")})).filter((item)=>item.slug&&item.name);
    const known=new Set(result.map((item)=>item.slug));
    state.posts.forEach((post)=>{
      postCategorySlugs(post).forEach((slug)=>{
        if(!known.has(slug)){result.push({slug,name:slug.replace(/-/g," ")});known.add(slug);}
      });
    });
    return result;
  }
  function selectedEditorCategories() {
    return Array.from(document.querySelectorAll("#post-category-options input[data-category-slug]:checked"))
      .map((input)=>input.dataset.categorySlug)
      .filter(Boolean);
  }
  function syncPrimaryCategorySelect(preferred) {
    const select=$("#post-primary-category");
    if(!select)return;
    const selected=selectedEditorCategories();
    const categories=getConfiguredCategories(state.settings);
    const options=[new Option(selected.length?"انتخاب دسته‌بندی اصلی":"ابتدا دسته‌بندی رو انتخاب کن","")];
    selected.forEach((slug)=>{
      const item=categories.find((category)=>category.slug===slug);
      if(item)options.push(new Option(item.name,item.slug));
    });
    select.replaceChildren(...options);
    const value=selected.includes(preferred)?preferred:(selected[0]||"");
    select.value=value;
    select.disabled=selected.length===0;
    if(selected.length===1)select.disabled=true;
  }
  function renderPostCategoryControls(values,primary) {
    const container=$("#post-category-options");
    if(!container)return;
    const configured=getConfiguredCategories(state.settings);
    const requested=Array.isArray(values)&&values.length
      ? values
      : (primary?[primary]:[]);
    const selected=new Set(requested.filter((slug)=>configured.some((item)=>item.slug===slug)).slice(0,3));
    container.replaceChildren();
    if(!configured.length){
      const empty=document.createElement("small");
      empty.textContent="ابتدا از تنظیمات، دسته‌بندی بساز.";
      container.appendChild(empty);
      syncPrimaryCategorySelect("");
      return;
    }
    configured.forEach((item)=>{
      const label=document.createElement("label");
      label.className="post-category-option";
      const input=document.createElement("input");
      input.type="checkbox";input.dataset.categorySlug=item.slug;input.checked=selected.has(item.slug);
      const name=document.createElement("span");name.textContent=item.name;name.dataset.categoryLabel=item.slug;
      input.addEventListener("change",()=>{
        const chosen=selectedEditorCategories();
        if(chosen.length>3){
          input.checked=false;
          toast("هر مقاله حداکثر می‌تونه سه دسته‌بندی داشته باشه.",true);
        }
        const preferredPrimary=$("#post-primary-category")?.value||primary;
        syncPrimaryCategorySelect(preferredPrimary);
      });
      label.append(input,name);
      container.appendChild(label);
    });
    syncPrimaryCategorySelect(primary);
  }
  function collectCategories(previous) {
    const list=$("#category-manager-list");
    if(!list)return Array.isArray(previous)?previous:[];
    return Array.from(list.querySelectorAll(".category-manager-item[data-category-slug]")).map((card)=>({
      slug:card.dataset.categorySlug,
      name:card.querySelector("[data-category-name]")?.value.trim()||"",
    })).filter((item)=>item.slug&&item.name);
  }
  function syncCategoryDrafts() {
    const current=state.settings||{};
    state.settings={
      ...current,
      categories:collectCategories(current.categories||[]),
      category_seo:collectCategorySeo(current.category_seo||{}),
    };
    return state.settings;
  }
  function renderCategoryManager(settings) {
    const list=$("#category-manager-list");
    if(!list)return;
    list.replaceChildren();
    const categories=getConfiguredCategories(settings);
    if(!categories.length){
      const empty=document.createElement("p");empty.className="empty-state";
      empty.textContent="هنوز دسته‌بندی‌ای تعریف نشده. از فرم پایین یک نام فارسی و نامک انگلیسی اضافه کن.";
      list.appendChild(empty);
    }
    categories.forEach((item)=>{
      const used=state.posts.filter((post)=>postCategorySlugs(post).includes(item.slug)).length;
      const row=document.createElement("div");row.className="category-manager-item";row.dataset.categorySlug=item.slug;
      const nameLabel=document.createElement("label");nameLabel.className="field-label";nameLabel.textContent="نام نمایشی";
      const name=document.createElement("input");name.type="text";name.maxLength=80;name.value=item.name;name.dataset.categoryName="true";
      nameLabel.appendChild(name);
      const slugBox=document.createElement("div");slugBox.className="category-manager-slug";
      const slugLabel=document.createElement("small");slugLabel.textContent="نامک انگلیسی";
      const slugValue=document.createElement("code");slugValue.textContent=item.slug;slugValue.dir="ltr";
      slugBox.append(slugLabel,slugValue);
      const count=document.createElement("small");count.className="category-manager-count";count.textContent=used.toLocaleString("fa-IR")+" مقاله";
      const remove=document.createElement("button");remove.type="button";remove.className="text-button danger-text";remove.textContent="حذف";
      remove.disabled=used>0;
      remove.title=used>0?"ابتدا مقاله‌های این دسته‌بندی رو به دسته‌بندی دیگه منتقل کن.":"حذف دسته‌بندی";
      remove.addEventListener("click",()=>{
        syncCategoryDrafts();
        const next=(state.settings?.categories||[]).filter((entry)=>entry.slug!==item.slug);
        state.settings={...(state.settings||{}),categories:next};
        const seo={...(state.settings.category_seo||{})};delete seo[item.slug];
        state.settings.category_seo=seo;
        renderCategoryManager(state.settings);renderPostCategoryControls(state.currentPost?.categories,state.currentPost?.primary_category||state.currentPost?.category);
        renderCategorySeoEditor(state.settings);
        $("#category-manager-message").textContent="دسته‌بندی حذف شد؛ برای ثبت نهایی تنظیمات رو ذخیره کن.";
      });
      row.append(nameLabel,slugBox,count,remove);
      list.appendChild(row);
    });
    if(state.currentPost)renderPostCategoryControls(state.currentPost.categories,state.currentPost.primary_category||state.currentPost.category);
  }
  function addManagedCategory() {
    syncCategoryDrafts();
    const name=$("#new-category-name").value.trim();
    const slug=$("#new-category-slug").value.trim().toLowerCase();
    const message=$("#category-manager-message");
    if(!name||!slug){message.textContent="نام فارسی و نامک انگلیسی رو وارد کن.";return;}
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)){message.textContent="نامک باید انگلیسی، با حروف کوچک و خط تیره باشه.";return;}
    const categories=getConfiguredCategories(state.settings);
    if(categories.some((item)=>item.slug===slug)){message.textContent="این نامک قبلاً ثبت شده.";return;}
    if(categories.some((item)=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase())){message.textContent="این نام فارسی قبلاً ثبت شده.";return;}
    state.settings={...(state.settings||{}),categories:[...categories,{slug,name}]};
    renderCategoryManager(state.settings);renderPostCategoryControls(state.currentPost?.categories,state.currentPost?.primary_category||state.currentPost?.category);
    renderCategorySeoEditor(state.settings);
    $("#new-category-name").value="";$("#new-category-slug").value="";
    message.textContent="دسته‌بندی اضافه شد؛ برای انتشار در وبلاگ تنظیمات رو ذخیره کن.";
  }

  function categorySeoEntries() {
    return collectCategories(state.settings?.categories||[])
      .map((item)=>[item.slug,item.name])
      .sort((a,b)=>a[1].localeCompare(b[1],"fa"));
  }
  function renderCategorySeoEditor(settings) {
    const list=$("#category-seo-list");if(!list)return;
    list.replaceChildren();
    const categories=categorySeoEntries();
    if(!categories.length){
      const note=document.createElement("p");note.className="empty-state";
      note.textContent="هنوز دسته‌بندی‌ای تعریف نشده. ابتدا از بخش مدیریت دسته‌بندی‌ها یک دسته اضافه کن تا تنظیمات سئوش اینجا در دسترس باشه.";
      list.appendChild(note);return;
    }
    const current=settings.category_seo||{};
    categories.forEach(([slug,name])=>{
      const values=current[slug]||{};
      const card=document.createElement("section");card.className="category-seo-card";card.dataset.categorySlug=slug;
      const heading=document.createElement("div");heading.className="category-seo-heading";
      const title=document.createElement("strong");title.textContent=name;
      const slugLabel=document.createElement("small");slugLabel.textContent="/blog/category/"+slug+"/";slugLabel.dir="ltr";
      heading.append(title,slugLabel);card.appendChild(heading);
      const grid=document.createElement("div");grid.className="category-seo-fields";
      const addField=(labelText,key,value,tag)=>{
        const label=document.createElement("label");label.className="field-label";label.textContent=labelText;
        const field=document.createElement(tag==="textarea"?"textarea":"input");
        if(tag!=="textarea")field.type="text";
        field.value=value||"";field.maxLength=key==="meta_description"?320:key==="og_description"?300:key==="seo_title"?75:500;
        field.dataset.categoryField=key;
        if(tag==="textarea")field.rows=2;
        label.appendChild(field);grid.appendChild(label);
      };
      addField("عنوان سئو","seo_title",values.seo_title,"input");
      addField("توضیحات متا","meta_description",values.meta_description,"textarea");
      addField("توضیح نمایشی دسته‌بندی","description",values.description,"textarea");
      addField("عنوان اشتراک‌گذاری","og_title",values.og_title,"input");
      addField("توضیح اشتراک‌گذاری","og_description",values.og_description,"textarea");
      addField("نشانی معیار","canonical_url",values.canonical_url,"input");
      card.appendChild(grid);
      const options=document.createElement("div");options.className="check-row";
      const indexLabel=document.createElement("label");const index=document.createElement("input");
      index.type="checkbox";index.dataset.categoryField="robots_index";index.checked=values.robots_index!==false;
      indexLabel.append(index,document.createTextNode(" این دسته‌بندی در موتورهای جست‌وجو ایندکس بشه"));
      const followLabel=document.createElement("label");const follow=document.createElement("input");
      follow.type="checkbox";follow.dataset.categoryField="robots_follow";follow.checked=values.robots_follow!==false;
      followLabel.append(follow,document.createTextNode(" لینک‌های این دسته‌بندی دنبال بشن"));
      options.append(indexLabel,followLabel);card.appendChild(options);
      list.appendChild(card);
    });
  }
  function collectCategorySeo(previous) {
    const result={...(previous||{})};
    document.querySelectorAll(".category-seo-card[data-category-slug]").forEach((card)=>{
      const item={};
      card.querySelectorAll("[data-category-field]").forEach((field)=>{
        item[field.dataset.categoryField]=field.type==="checkbox"?field.checked:field.value.trim();
      });
      result[card.dataset.categorySlug]=item;
    });
    return result;
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
      enable_rss:check("setting-rss"),default_meta_title:get("setting-meta-title"),default_meta_description:get("setting-meta-description"),canonical_url:get("setting-canonical-url"),
      footer_note:get("setting-footer"),default_og_image:settings?.default_og_image||"",
      categories:collectCategories(settings?.categories||[]),
      category_seo:collectCategorySeo(settings?.category_seo||{}),
      default_og_title:get("setting-default-og-title"),default_og_description:get("setting-default-og-description"),
      default_robots_index:check("setting-default-index"),default_robots_follow:check("setting-default-follow"),
      noindex_empty_categories:check("setting-noindex-empty"),
      sitemap_include_categories:check("setting-sitemap-categories"),sitemap_include_articles:check("setting-sitemap-articles"),
      schema_type:get("setting-schema-type"),breadcrumbs_enabled:check("setting-breadcrumbs"),
      breadcrumb_home_label:get("setting-breadcrumb-label"),open_graph_enabled:check("setting-open-graph"),
      twitter_card_type:get("setting-twitter-card"),
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
    set("setting-meta-title",settings.default_meta_title);set("setting-meta-description",settings.default_meta_description);set("setting-canonical-url",settings.canonical_url);
    set("setting-default-og-title",settings.default_og_title);set("setting-default-og-description",settings.default_og_description);
    set("setting-schema-type",settings.schema_type||"Article");set("setting-breadcrumb-label",settings.breadcrumb_home_label||"خانه");
    set("setting-twitter-card",settings.twitter_card_type||"summary_large_image");
    check("setting-default-index",settings.default_robots_index);check("setting-default-follow",settings.default_robots_follow);
    check("setting-noindex-empty",settings.noindex_empty_categories);check("setting-sitemap-categories",settings.sitemap_include_categories);
    check("setting-sitemap-articles",settings.sitemap_include_articles);check("setting-breadcrumbs",settings.breadcrumbs_enabled);
    check("setting-open-graph",settings.open_graph_enabled);
    renderCategoryManager(settings);
    const theme=document.querySelector('input[name="setting-theme"][value="'+(settings.background_theme||"paper")+'"]');if(theme)theme.checked=true;
    check("setting-search",settings.show_search);check("setting-categories",settings.show_categories);
    check("setting-featured",settings.show_featured);check("setting-readtime",settings.show_reading_time);
    check("setting-toc",settings.show_toc);check("setting-related",settings.show_related_posts);
    check("setting-share",settings.show_share);check("setting-rss",settings.enable_rss);
    renderCategorySeoEditor(settings);
    updateImagePreview("setting-og-preview",settings.default_og_image,"تصویر پیش‌فرض وبلاگ");
  }
  function defaultAdBanners() {
    return [makeDefaultAdBanner(1),makeDefaultAdBanner(2),makeDefaultAdBanner(3)];
  }
  function makeDefaultAdBanner(index) {
    return {id:"banner-"+index,enabled:false,label:"",image_url:"",alt:"",link_url:"",link_rel:"follow",show_on_mobile:true};
  }
  function normalizeAdBanners(value) {
    const entries=Array.isArray(value)?value.filter((item)=>item&&typeof item==="object"&&!Array.isArray(item)):[];
    const byId=new Map(entries.map((item)=>[String(item.id||""),item]));
    const core=[1,2,3].map((index)=>{
      const saved=byId.get("banner-"+index);
      return {...makeDefaultAdBanner(index),...(saved||{}),id:"banner-"+index,show_on_mobile:saved?.show_on_mobile!==false};
    });
    const extras=entries.filter((item)=>!/^banner-[123]$/.test(String(item.id||""))).map((item)=>({
      enabled:false,label:"",image_url:"",alt:"",link_url:"",link_rel:"follow",show_on_mobile:true,
      ...item,show_on_mobile:item.show_on_mobile!==false,
    }));
    return [...core,...extras].slice(0,8);
  }
  function nextAdBannerIndex() {
    let index=4;
    const usedIds=new Set([
      ...(state.adBanners||[]),
      ...(Array.isArray(state.settings?.ad_banners)?state.settings.ad_banners:[]),
    ].map((banner)=>String(banner.id||"")));
    while(usedIds.has("banner-"+index))index++;
    return index;
  }
  function collectAdBannersFromForm() {
    const root=$("#ad-banners-list");
    if(!root)return state.adBanners||defaultAdBanners();
    return [...root.querySelectorAll("[data-ad-card]")].map((card)=>({
      id:card.dataset.adCard||"",
      enabled:Boolean(card.querySelector('[data-ad-field="enabled"]')?.checked),
      label:card.querySelector('[data-ad-field="label"]')?.value.trim()||"",
      image_url:card.querySelector('[data-ad-field="image_url"]')?.value.trim()||"",
      alt:card.querySelector('[data-ad-field="alt"]')?.value.trim()||"",
      link_url:card.querySelector('[data-ad-field="link_url"]')?.value.trim()||"",
      link_rel:card.querySelector('[data-ad-field="link_rel"]')?.value||"follow",
      show_on_mobile:Boolean(card.querySelector('[data-ad-field="show_on_mobile"]')?.checked),
    }));
  }
  function renderAdBannerSettings() {
    const root=$("#ad-banners-list");
    if(!root)return;
    state.adBanners=normalizeAdBanners(state.adBanners);
    const relOptions=[
      ["follow","دوفالو (Follow)"],
      ["nofollow","نوفالو (Nofollow)"],
      ["sponsored","اسپانسر (Sponsored)"],
      ["ugc","محتوای کاربر (UGC)"],
      ["nofollow sponsored","نوفالو + اسپانسر"],
      ["nofollow ugc","نوفالو + UGC"],
      ["nofollow sponsored ugc","نوفالو + اسپانسر + UGC"],
    ];
    root.innerHTML=state.adBanners.map((banner,index)=>{
      const id=escapeHtml(banner.id||("banner-"+(index+1)));
      const isArticleEnd=banner.id==="banner-3";
      const placementLabel=isArticleEnd?"انتهای متن مقاله":"کنار فهرست مقاله";
      const image=banner.image_url?'<img src="'+escapeHtml(banner.image_url)+'" alt="">':'<span class="ad-preview-placeholder">'+(isArticleEnd?"پیش‌نمایش بنر افقی ۸٫۵:۱":"پیش‌نمایش تصویر ۱:۱")+'</span>';
      const options=relOptions.map(([value,label])=>'<option value="'+value+'" '+((banner.link_rel||"follow")===value?"selected":"")+'>'+label+'</option>').join("");
      const clickData=state.adClickCounts[banner.id];
      const clickCount=clickData?Number(clickData.click_count||0).toLocaleString("fa-IR"):(state.adClickCountsBusy?"…":"۰");
      const resetLabel=clickData?.reset_at?"آخرین ریست: "+dateLabel(clickData.reset_at):"شمارش هنوز ریست نشده";
      const isPersisted=Array.isArray(state.settings?.ad_banners)&&state.settings.ad_banners.some((saved)=>saved.id===banner.id);
      const resetButton='<button class="button button-light ad-reset-clicks" type="button" data-reset-ad-clicks="'+id+'" '+(isPersisted?"":"disabled title=\"بعد از ذخیرۀ جایگاه فعال می‌شه\"")+' aria-label="ریست شمارش کلیک جایگاه تبلیغاتی '+(index+1)+'">ریست شمارش</button>';
      const remove=index>=3?'<button class="text-button danger-text" type="button" data-remove-ad="'+id+'">حذف این جایگاه</button>':"";
      return `
        <article class="ad-management-card" data-ad-card="${id}">
          <header class="ad-management-heading">
            <div><span class="kicker">جایگاه / ${String(index+1).padStart(2,"0")}</span><h2>جایگاه تبلیغاتی ${index+1}</h2><small>${placementLabel}</small></div>
            <label class="ad-enabled-toggle"><input type="checkbox" data-ad-field="enabled" ${banner.enabled?"checked":""}> فعال‌سازی</label>
          </header>
          <div class="ad-management-layout">
            <div class="ad-management-media">
              <div class="ad-management-preview${isArticleEnd?" is-article-end":""}">${image}</div>
              <label class="file-button ad-file-button">انتخاب تصویر<input type="file" data-ad-file accept="image/jpeg,image/png,image/webp,image/gif"></label>
              <small>JPG، PNG، WebP یا GIF متحرک؛ حداکثر ۳ مگابایت</small>
              <input type="hidden" data-ad-field="image_url" value="${escapeHtml(banner.image_url||"")}">
            </div>
            <div class="ad-management-fields">
              <label class="field-label">نوع بنر (اختیاری)<input data-ad-field="label" maxlength="48" value="${escapeHtml(banner.label||"")}" placeholder="مثلاً تبلیغات یا اسپانسر"></label>
              <label class="field-label">متن جایگزین تصویر<input data-ad-field="alt" maxlength="240" value="${escapeHtml(banner.alt||"")}" placeholder="شرح تصویر برای دسترس‌پذیری"></label>
              <label class="field-label">پیوند مقصد<input data-ad-field="link_url" type="url" inputmode="url" maxlength="800" dir="ltr" value="${escapeHtml(banner.link_url||"")}" placeholder="https://example.com/"></label>
              <label class="field-label">نوع لینک<select data-ad-field="link_rel">${options}</select></label>
              <label class="ad-mobile-toggle"><input type="checkbox" data-ad-field="show_on_mobile" ${banner.show_on_mobile!==false?"checked":""}> نمایش در نسخۀ موبایل</label>
              <p class="help-text">اگر نوع بنر خالی باشه، نشانگر بالای تصویر نمایش داده نمی‌شه. لینک فقط با HTTPS ذخیره می‌شه. برای جایگاه سوم، فایل افقی با نسبت حدود ۸٫۵:۱ انتخاب کن.</p>
            </div>
          </div>
          <div class="ad-click-metrics" aria-live="polite">
            <div class="ad-click-stat">
              <span>کلیک‌های ثبت‌شده</span>
              <strong data-ad-click-count>${clickCount}</strong>
              <small data-ad-click-reset>${escapeHtml(resetLabel)}</small>
            </div>
            ${resetButton}
          </div>
          <footer class="ad-management-footer"><span>${banner.enabled?"نمایش "+placementLabel+" در مقاله‌ها فعال است.":"این جایگاه در سایت عمومی نمایش داده نمی‌شه."}</span>${remove}</footer>
        </article>`;
    }).join("");
    updateAdClickMetrics();
  }
  function updateAdClickMetrics() {
    document.querySelectorAll("[data-ad-card]").forEach((card)=>{
      const id=card.dataset.adCard||"";
      const count=state.adClickCounts[id];
      const number=card.querySelector("[data-ad-click-count]");
      const reset=card.querySelector("[data-ad-click-reset]");
      if(number){
        number.textContent=count
          ?Number(count.click_count||0).toLocaleString("fa-IR")
          :(state.adClickCountsBusy?"…":state.adClickCountsUnavailable?"—":"۰");
      }
      if(reset){
        reset.textContent=count?.reset_at
          ?"آخرین ریست: "+dateLabel(count.reset_at)
          :"شمارش هنوز ریست نشده";
      }
    });
  }
  async function loadAdClickCounts(silent=false) {
    if(state.adClickCountsBusy)return;
    state.adClickCountsBusy=true;
    if($("#ad-click-status"))$("#ad-click-status").textContent="در حال دریافت شمارش کلیک‌ها…";
    updateAdClickMetrics();
    try{
      const result=await api("get_ad_click_counts");
      state.adClickCounts=Object.fromEntries((Array.isArray(result.counts)?result.counts:[])
        .map((item)=>[item.banner_id,item]));
      state.adClickCountsUnavailable=false;
      if($("#ad-click-status")){
        $("#ad-click-status").textContent="آخرین دریافت آمار: "+new Date().toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"});
      }
      updateAdClickMetrics();
    }catch(error){
      state.adClickCountsUnavailable=true;
      if($("#ad-click-status"))$("#ad-click-status").textContent="دریافت آمار ناموفق بود؛ دوباره تلاش کن.";
      updateAdClickMetrics();
      if(!silent)toast(error.message,true);
    }finally{
      state.adClickCountsBusy=false;
    }
  }
  async function resetAdClickCount(button) {
    const id=button?.dataset.resetAdClicks||"";
    const banner=state.adBanners.find((item)=>item.id===id);
    if(!banner)return;
    const label="جایگاه تبلیغاتی "+(state.adBanners.findIndex((item)=>item.id===id)+1);
    if(!window.confirm("شمارش کلیک‌های «"+label+"» به صفر برگرده؟ این کار قابل بازگشت نیست."))return;
    setButton(button,true,"در حال ریست…");
    try{
      const result=await api("reset_ad_click_count",{banner_id:id});
      state.adClickCounts={...(state.adClickCounts||{}),[id]:result.count};
      updateAdClickMetrics();
      toast("شمارش کلیک‌های "+label+" به صفر برگشت.");
    }catch(error){
      toast(error.message,true);
    }finally{
      setButton(button,false);
    }
  }
  async function saveAdBanners(event) {
    event.preventDefault();
    const button=$("#save-ad-banners");
    state.adBanners=collectAdBannersFromForm();
    setButton(button,true,"در حال ذخیره…");
    $("#ad-banners-message").textContent="در حال اعتبارسنجی تنظیمات و آماده‌سازی انتشار…";
    try{
      const result=await api("save_ad_banners",{banners:state.adBanners});
      state.settings={...(state.settings||{}),...(result.settings||{})};
      state.adBanners=normalizeAdBanners(result.settings?.ad_banners||state.adBanners);
      renderAdBannerSettings();
      $("#ad-banners-message").textContent="تنظیمات ذخیره شد و ساخت نسخۀ عمومی آغاز شد.";
      await loadAdClickCounts(true);
      toast("بنرها ذخیره شدن؛ بعد از Build در همۀ مقاله‌ها به‌روزرسانی می‌شن.");
    }catch(error){
      $("#ad-banners-message").textContent=error.message;
      toast(error.message,true);
    }finally{setButton(button,false);}
  }
  async function loadSettings() {
    const result=await api("get_settings");fillSettings(result.settings||{});
    state.adBanners=normalizeAdBanners(result.settings?.ad_banners);
  }
  async function saveSettings(event) {
    event.preventDefault();
    const button=$("#save-settings");setButton(button,true,"در حال ذخیره…");
    try {
      const result=await api("save_settings",{settings:parseSettingsForm(state.settings)});
      state.settings=result.settings;
      if(result.buildDispatched){
        $("#settings-message").textContent="تنظیمات ذخیره شد و ساخت سایت آغاز شد.";
        toast("تنظیمات ذخیره شد؛ بعد از Build سایت‌مپ هم به‌روز می‌شه.");
      }else{
        $("#settings-message").textContent="تنظیمات ذخیره شد؛ انتشار عمومی منتظر تنظیم توکن GitHub است.";
        toast("تنظیمات ذخیره شد. برای اعمال روی سایت، توکن انتشار GitHub رو در تنظیمات سرور ثبت کن.",true);
      }
    }catch(error){toast(error.message,true);}
    finally{setButton(button,false);}
  }
  async function loadWorkspace() {
    const results=await Promise.all([api("list_posts"),api("get_settings")]);
    state.posts=Array.isArray(results[0].posts)?results[0].posts:[];
    state.settings=results[1].settings||{};
    state.adBanners=normalizeAdBanners(state.settings.ad_banners);
    renderOverview();renderPosts();fillSettings(state.settings);
  }
  function bindEvents() {
    document.querySelectorAll("[data-view]").forEach((button)=>button.addEventListener("click",()=>{
      const name=button.dataset.view;
      if(name!=="editor"&&!confirmLeaveEditor())return;
      showView(name);if(name==="settings")void loadSettings().catch((e)=>toast(e.message,true));
      if(name==="ads"){renderAdBannerSettings();void loadAdClickCounts(true);}
      if(name==="analytics"){state.analyticsVisited=true;void loadArticleAnalytics(false);}
    }));
    document.querySelectorAll("[data-new-post]").forEach((button)=>button.addEventListener("click",newArticle));
    $("#back-to-posts").addEventListener("click",()=>{if(confirmLeaveEditor())showView("posts");});
    document.querySelectorAll(".editor-tab").forEach((button)=>button.addEventListener("click",()=>showTab(button.dataset.tab)));
    $(".editor-tabs").addEventListener("keydown",(event)=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      const tabs=[...document.querySelectorAll(".editor-tab")];
      const currentIndex=tabs.indexOf(document.activeElement);
      if(currentIndex<0)return;
      event.preventDefault();
      let nextIndex=currentIndex;
      if(event.key==="Home")nextIndex=0;
      else if(event.key==="End")nextIndex=tabs.length-1;
      else{
        const rtl=getComputedStyle($(".editor-tabs")).direction==="rtl";
        const step=event.key==="ArrowRight"?(rtl?-1:1):(rtl?1:-1);
        nextIndex=(currentIndex+step+tabs.length)%tabs.length;
      }
      showTab(tabs[nextIndex].dataset.tab,true);
    });
    $("#posts-search").addEventListener("input",renderPosts);$("#posts-filter").addEventListener("change",renderPosts);
    $("#refresh-article-analytics").addEventListener("click",()=>void loadArticleAnalytics(true));
    $("#refresh-ad-click-counts").addEventListener("click",()=>void loadAdClickCounts());
    $("#article-analytics-search").addEventListener("input",renderArticleAnalytics);
    $("#editor-form").addEventListener("input",markEditorDirty);
    $("#editor-form").addEventListener("change",markEditorDirty);
    $("#post-content").addEventListener("input",()=>{updatePreview();updateSeo();refreshLinkManager();updateFormatToolbar();});
    ["keyup","mouseup","focus"].forEach((eventName)=>$("#post-content").addEventListener(eventName,updateFormatToolbar));
    document.addEventListener("selectionchange",updateFormatToolbar);
    $("#post-content").addEventListener("paste",handleEditorPaste);
    $("#link-settings-toggle").addEventListener("click",()=>{const panel=$("#link-settings");panel.hidden=!panel.hidden;refreshLinkManager();});
    document.querySelectorAll("[data-command]").forEach((button)=>{
      button.addEventListener("mousedown",(event)=>event.preventDefault());
      button.addEventListener("click",()=>{
        const editor=$("#post-content");editor.focus();
        const command=button.dataset.command,value=button.dataset.value||null;
        if(command==="formatBlock"&&value==="BLOCKQUOTE"){
          const blockquote=getSelectedBlockquote();
          if(blockquote)unwrapBlockquote(blockquote);
          else document.execCommand("formatBlock",false,"BLOCKQUOTE");
        }else if(command==="formatBlock"){
          const active=currentEditorBlock()?.tagName===value;
          document.execCommand("formatBlock",false,active?"P":value);
        }else{
          document.execCommand(command,false,value);
        }
        markEditorDirty();
        updatePreview();updateSeo();refreshLinkManager();updateFormatToolbar();
      });
    });
    $("#insert-link").addEventListener("click",insertLink);
    $("#insert-image").addEventListener("mousedown",(event)=>event.preventDefault());
    $("#insert-image").addEventListener("click",beginInlineImageInsert);
    $("#inline-image-file").addEventListener("change",(event)=>{
      const file=event.target.files?.[0];
      event.target.value="";
      if(file)openInlineImageDialog(file,null);
    });
    $("#inline-image-form").addEventListener("submit",(event)=>void saveInlineImage(event));
    $("#inline-image-cancel").addEventListener("click",closeInlineImageDialog);
    $("#inline-image-dialog").addEventListener("cancel",(event)=>{event.preventDefault();closeInlineImageDialog();});
    $("#post-content").addEventListener("dblclick",(event)=>{
      const image=event.target instanceof Element?event.target.closest("figure img"):null;
      const figure=image?.closest("figure");
      if(figure&&$("#post-content").contains(figure))openInlineImageDialog(null,figure);
    });
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
    $("#ad-banners-list").addEventListener("input",()=>{
      state.adBanners=collectAdBannersFromForm();
    });
    $("#ad-banners-list").addEventListener("change",async(event)=>{
      const input=event.target.closest("[data-ad-file]");
      if(!input)return;
      const card=input.closest("[data-ad-card]"),file=input.files?.[0];
      if(!card||!file)return;
      const id=card.dataset.adCard;
      try{
        input.disabled=true;
        const url=await uploadImage(file);
        const next=collectAdBannersFromForm();
        const banner=next.find((item)=>item.id===id);
        if(banner)banner.image_url=url;
        state.adBanners=next;
        renderAdBannerSettings();
        toast(file.type==="image/gif"?"GIF متحرک بارگذاری شد.":"تصویر بنر بارگذاری شد.");
      }catch(error){toast(error.message,true);}
      finally{input.disabled=false;input.value="";}
    });
    $("#ad-banners-list").addEventListener("click",(event)=>{
      const resetButton=event.target.closest("[data-reset-ad-clicks]");
      if(resetButton){void resetAdClickCount(resetButton);return;}
      const button=event.target.closest("[data-remove-ad]");
      if(!button)return;
      const current=collectAdBannersFromForm();
      if(current.length<=3){toast("سه جایگاه اصلی قابل حذف نیستن.",true);return;}
      const bannerNumber=current.findIndex((item)=>item.id===button.dataset.removeAd)+1;
      if(!window.confirm("جایگاه تبلیغاتی "+bannerNumber+" حذف بشه؟ بعد از ذخیرۀ جایگاه‌ها، شمارش کلیک همین جایگاه هم پاک می‌شه."))return;
      state.adBanners=current.filter((item)=>item.id!==button.dataset.removeAd);
      renderAdBannerSettings();
    });
    $("#add-ad-banner").addEventListener("click",()=>{
      state.adBanners=collectAdBannersFromForm();
      if(state.adBanners.length>=8){toast("حداکثر هشت جایگاه تبلیغاتی مجازه.",true);return;}
      state.adBanners.push(makeDefaultAdBanner(nextAdBannerIndex()));
      renderAdBannerSettings();
    });
    $("#ad-banners-form").addEventListener("submit",(event)=>void saveAdBanners(event));
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
    $("#add-category-button").addEventListener("click",addManagedCategory);
    $("#new-category-name").addEventListener("keydown",(event)=>{if(event.key==="Enter"){event.preventDefault();$("#new-category-slug").focus();}});
    $("#new-category-slug").addEventListener("keydown",(event)=>{if(event.key==="Enter"){event.preventDefault();addManagedCategory();}});
    $("#category-manager-list").addEventListener("input",(event)=>{
      if(event.target.matches("[data-category-name]")){
        syncCategoryDrafts();
        const card=event.target.closest(".category-manager-item");
        const slug=card?.dataset.categorySlug;
        const seoCard=slug?document.querySelector('.category-seo-card[data-category-slug="'+CSS.escape(slug)+'"]'):null;
        const title=seoCard?.querySelector(".category-seo-heading strong");
        if(title)title.textContent=event.target.value.trim()||slug;
        const option=$("#post-category-options [data-category-label='"+slug+"']");
        if(option)option.textContent=event.target.value.trim()||slug;
        const primaryOption=$("#post-primary-category option[value='"+slug+"']");
        if(primaryOption)primaryOption.textContent=event.target.value.trim()||slug;
      }
    });
    $("#category-manager-list").addEventListener("change",(event)=>{
      if(event.target.matches("[data-category-name]"))syncCategoryDrafts();
    });
    $("#category-seo-list").addEventListener("input",syncCategoryDrafts);
    $("#category-seo-list").addEventListener("change",syncCategoryDrafts);
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
    document.querySelectorAll(".side-link").forEach((button)=>{
      const active=button.dataset.view===name;
      button.classList.toggle("active",active);
      if(active)button.setAttribute("aria-current","page");
      else button.removeAttribute("aria-current");
    });
    $("#workspace-title").textContent=({overview:"نمای کلی",posts:"مقاله‌ها",editor:"ویرایش مقاله",settings:"تنظیمات بلاگ",analytics:"آمار بازدید",ads:"بنرهای تبلیغاتی"})[name]||"مدیریت";
    if(name==="posts")renderPosts();
  }
  $("#login-form").addEventListener("submit",async(event)=>{
    event.preventDefault();if(!validConfig){$("#login-message").textContent="تنظیمات اتصال معتبر نیست.";return;}
    const button=$("#login-submit"),email=$("#login-email").value.trim(),password=$("#login-password").value,remember=$("#remember-me").checked;
    setButton(button,true,"در حال بررسی…");$("#login-message").textContent="";
    try{await finishSignIn(email,password,remember,false);}
    catch(error){state.accessToken="";state.refreshToken="";$("#login-password").value="";$("#login-message").textContent=error.message;}
    finally{setButton(button,false);}
  });
  bindEvents();
  window.setInterval(()=>{
    const refreshInterval=60*60*1000;
    if(state.accessToken&&state.analyticsVisited&&!state.analyticsBusy&&Date.now()-state.analyticsLastFetchedAt>=refreshInterval){
      void loadArticleAnalytics(true,true);
    }
  },60*1000);
  if(!validConfig){$("#login-submit").disabled=true;$("#login-message").textContent="اتصال امن داشبورد پیکربندی نشده.";}
  else void restoreRememberedCredential();
})();