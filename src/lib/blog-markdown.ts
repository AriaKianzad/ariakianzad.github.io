export type TocItem={id:string;title:string;level:number};
export function slugHeading(value:string){return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,"").replace(/\s+/g,"-").replace(/-+/g,"-")||"section";}
function esc(value:string){return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));}
function normalizeSameOriginPath(candidate:string){
  const fallbackOrigin="https://ariakianzad.github.io";
  let origin=fallbackOrigin;
  try{
    origin=new URL(process.env.NEXT_PUBLIC_SITE_URL||fallbackOrigin).origin;
  }catch{}
  try{
    const url=new URL(candidate,origin);
    if(url.origin!==origin||!["http:","https:"].includes(url.protocol))return candidate;
    const pathname=url.pathname.replace(/\/{2,}/g,"/");
    if(pathname===url.pathname)return candidate;
    url.pathname=pathname;
    if(candidate.startsWith("/")&&candidate[1]!=="/"&&candidate[1]!==String.fromCharCode(92)){
      return url.pathname+url.search+url.hash;
    }
    return url.href;
  }catch{
    return candidate;
  }
}
function allowedUrl(value:string){
  const candidate=value.trim();
  if(!candidate)return "#";
  if(candidate.startsWith("#"))return candidate;
  if(candidate.startsWith("/")&&candidate[1]!=="/"&&candidate[1]!==String.fromCharCode(92)){
    return normalizeSameOriginPath(candidate);
  }
  if(candidate.startsWith("/")||candidate.startsWith(String.fromCharCode(92)))return "#";
  try{
    const url=new URL(candidate);
    if(["http:","https:","mailto:"].includes(url.protocol)&&!url.username&&!url.password){
      return ["http:","https:"].includes(url.protocol)?normalizeSameOriginPath(candidate):candidate;
    }
  }catch{}
  return "#";
}
function plainInline(value:string){
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g,"$1")
    .replace(/\[([^\]]+)\]\([^)]+\)(?:\{[^}]*\})?/g,"$1")
    .replace(/\x60+([^\x60]+)\x60+/g,"$1")
    .replace(/(\*\*|__)(.*?)\1/g,"$2")
    .replace(/~~(.*?)~~/g,"$1")
    .replace(/\+\+(.*?)\+\+/g,"$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,"$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g,"$1")
    .replace(/<[^>]*>/g,"")
    .replace(/\\([\\\x60*{}\[\]()#+\-.!_>])/g,"$1")
    .replace(/\s+/g," ")
    .trim();
}
function inline(value:string){
  let s=esc(value);
  const protectedFragments:Array<{token:string;html:string}>=[];
  let nextToken=0;
  const protect=(html:string)=>{
    let token:string;
    do{
      token="\uE000"+(nextToken++).toString(36)+"\uE001";
    }while(s.includes(token));
    protectedFragments.push({token,html});
    return token;
  };

  // Keep generated HTML tags out of the Markdown formatting regexes. The
  // link label stays in the source string so bold/italic inside it still works.
  s=s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,(_m,alt,url,title)=>{
    const html='<img src="'+esc(allowedUrl(url.replace(/&amp;/g,"&")))+'" alt="'+alt+'"'+(title?' title="'+title+'"':"")+' loading="lazy" decoding="async">';
    return protect(html);
  });
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(?:\{([^}]*)\})?/g,(_m,label,url,title,options)=>{
    const href=allowedUrl(url.replace(/&amp;/g,"&")),external=/^https?:\/\//i.test(href);
    const relation=(String(options||"").match(/rel=(follow|nofollow|sponsored|ugc)/i)||[])[1]||(external?"nofollow":"follow");
    const target=(String(options||"").match(/target=(_blank|_self)/i)||[])[1]||(external?"_blank":"");
    const rel=[...(relation!=="follow"?[relation]:[]),...(target==="_blank"?["noopener","noreferrer"]:[])].join(" ");
    const opening='<a href="'+esc(href)+'"'+(title?' title="'+esc(title)+'"':"")+(target?' target="'+target+'"':"")+(rel?' rel="'+rel+'"':"")+'>';
    return protect(opening)+label+protect("</a>");
  });
  s=s.replace(/\x60([^\x60]+)\x60/g,"<code>$1</code>");
  s=s.replace(/\+\+([^+]+)\+\+/g,"<u>$1</u>").replace(/~~([^~]+)~~/g,"<del>$1</del>");
  s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_]+)__/g,"<strong>$1</strong>");
  s=s.replace(/\*([^*]+)\*/g,"<em>$1</em>").replace(/_([^_]+)_/g,"<em>$1</em>");

  for(const fragment of protectedFragments){
    s=s.replace(fragment.token,fragment.html);
  }
  return s;
}

type MarkdownImage = { url:string; alt:string; title:string; caption:string };
function parseImageLine(line:string):MarkdownImage|null{
  const match=String(line||"").trim().match(/^!\[(.*?)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)(?:\s+"(.*?)")?\)(?:\s+\{caption="(.*?)"\})?$/);
  if(!match)return null;
  const url=allowedUrl(match[2].replace(/&amp;/g,"&"));
  if(url==="#")return null;
  return {url,alt:match[1],title:match[3]||"",caption:match[4]||""};
}
export function extractMarkdownImageUrls(markdown:string):string[]{
  const urls:string[]=[];
  const add=(url:string)=>{const safe=allowedUrl(url.replace(/&amp;/g,"&"));if(safe!="#"&&!urls.includes(safe))urls.push(safe);};
  for(const line of markdown.replace(/\r\n/g,"\n").split("\n")){
    const image=parseImageLine(line);
    if(image)add(image.url);
    const inlineImages=line.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/[^)\s]+)(?:\s+"[^"]*")?\)/g);
    for(const match of inlineImages)add(match[1]);
  }
  return urls;
}
type LegacyNumberedHeading={level:number;number:string;title:string};
function parseLegacyNumberedHeading(lines:string[],index:number):LegacyNumberedHeading|null{
  const heading=String(lines[index]||"").match(/^\s{0,3}(#{2,4})\s+\*\*\s*$/);
  const numbered=String(lines[index+1]||"").match(/^\s*([0-9۰-۹٠-٩]+)[.)]\s+(.+?)\*\*\s*$/);
  if(!heading||!numbered)return null;
  return {level:Math.min(4,Math.max(2,heading[1].length)),number:numbered[1],title:numbered[2].replace(/^\*\*/,"").trim()};
}
type LegacyNumberedHeadingItem=LegacyNumberedHeading&{body:string[]};
function parseLegacyNumberedHeadingList(lines:string[],start:number):{items:LegacyNumberedHeadingItem[];endIndex:number}|null{
  if(!parseLegacyNumberedHeading(lines,start))return null;
  const items:LegacyNumberedHeadingItem[]=[];let cursor=start;
  while(cursor<lines.length){
    const heading=parseLegacyNumberedHeading(lines,cursor);
    if(!heading)break;
    let end=cursor+2;
    while(end<lines.length&&!parseLegacyNumberedHeading(lines,end)){
      if(/^\s{0,3}#{2,4}\s+/.test(lines[end]))break;
      end++;
    }
    items.push({...heading,body:lines.slice(cursor+2,end)});
    cursor=end;
    if(!parseLegacyNumberedHeading(lines,cursor))break;
  }
  return items.length?{items,endIndex:cursor-1}:null;
}
function arabicIndicNumber(value:string){
  return Number(value.replace(/[0-9۰-۹٠-٩]/g,(digit)=>{
    if(/[0-9]/.test(digit))return digit;
    const persian="۰۱۲۳۴۵۶۷۸۹".indexOf(digit);
    if(persian>=0)return String(persian);
    const arabic="٠١٢٣٤٥٦٧٨٩".indexOf(digit);
    return arabic>=0?String(arabic):digit;
  }));
}
export function extractToc(markdown:string):TocItem[]{
  const lines=markdown.replace(/\r\n/g,"\n").split("\n");
  const seen=new Map<string,number>(),items:TocItem[]=[];
  const add=(level:number,title:string)=>{
    const base=slugHeading(title),count=seen.get(base)||0;seen.set(base,count+1);
    if(level<2||level>3)return;
    items.push({id:count?base+"-"+(count+1):base,title:plainInline(title),level});
  };
  for(let index=0;index<lines.length;index++){
    const legacy=parseLegacyNumberedHeading(lines,index);
    if(legacy){add(legacy.level,"**"+legacy.title+"**");index++;continue;}
    const line=lines[index].trimStart();
    const listHeading=line.match(/^(?:[-*+]|[0-9۰-۹٠-٩]+[.)])\s+(#{1,4})\s+(.+)$/);
    if(listHeading){add(listHeading[1].length,listHeading[2].trim());continue;}
    const heading=line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
    if(heading){add(heading[1].length,heading[2].trim());continue;}
    if(line.trim()&&index+1<lines.length){
      const setext=lines[index+1].trim().match(/^(={3,}|-{3,})$/);
      if(setext)add(setext[1][0]==="="?2:3,line.trim());
    }
  }
  return items;
}
function tableCells(line:string){
  const source=line.trim();
  let value=source;
  if(value.startsWith("|"))value=value.slice(1);
  if(value.endsWith("|")){
    let escapes=0;
    for(let index=value.length-2;index>=0&&value[index]==="\\";index--)escapes++;
    if(escapes%2===0)value=value.slice(0,-1);
  }
  const cells:string[]=[];let cell="",inCode=false;
  for(let index=0;index<value.length;index++){
    const char=value[index];
    if(char==="\\"&&value[index+1]==="|"){cell+="|";index++;continue;}
    if(char==="`")inCode=!inCode;
    if(char==="|"&&!inCode){cells.push(cell.trim());cell="";continue;}
    cell+=char;
  }
  cells.push(cell.trim());
  return cells;
}
function isTableDivider(line:string,columns:number){
  const cells=tableCells(line);
  return cells.length===columns&&columns>=2&&cells.every((cell)=>/^:?-{3,}:?$/.test(cell));
}
type MarkdownListItem={depth:number;type:"ul"|"ol";content:string;headingLevel:number|null};
function parseMarkdownListItem(line:string):MarkdownListItem|null{
  const match=line.match(/^(\s*)([-*+]|[0-9۰-۹٠-٩]+[.)])\s+(.+)$/);
  if(!match)return null;
  const indent=match[1].replace(/\t/g,"  ").length;
  const rawContent=match[3],heading=rawContent.match(/^(#{1,4})\s+(.+)$/);
  return {
    depth:Math.floor(indent/2),
    type:/^[0-9۰-۹٠-٩]/.test(match[2])?"ol":"ul",
    content:heading?heading[2]:rawContent,
    headingLevel:heading?Math.min(4,Math.max(2,heading[1].length)):null
  };
}
export function renderMarkdown(markdown:string):string{
  const lines=markdown.replace(/\r\n/g,"\n").split("\n"),out:string[]=[];
  const seen=new Map<string,number>();let paragraph:string[]=[],code:string[]|null=null,language="";
  const listStack:{type:"ul"|"ol";depth:number;itemOpen:boolean}[]=[];
  const closeP=()=>{if(paragraph.length){out.push("<p>"+inline(paragraph.join(" "))+"</p>");paragraph=[];}};
  const closeL=(keepDepth=0)=>{
    while(listStack.length>keepDepth){
      const current=listStack.pop()!;
      if(current.itemOpen)out.push("</li>");
      out.push("</"+current.type+">");
    }
  };
  const appendListItem=(item:MarkdownListItem)=>{
    let depth=item.depth;
    if(!listStack.length)depth=0;
    while(listStack.length&&depth<listStack[listStack.length-1].depth)closeL(listStack.length-1);
    if(!listStack.length)depth=0;
    let current=listStack[listStack.length-1];
    if(!current){
      out.push("<"+item.type+">");
      listStack.push({type:item.type,depth,itemOpen:false});
      current=listStack[listStack.length-1];
    }else if(depth>current.depth){
      if(!current.itemOpen){out.push("<li>");current.itemOpen=true;}
      out.push("<"+item.type+">");
      listStack.push({type:item.type,depth:current.depth+1,itemOpen:false});
      current=listStack[listStack.length-1];
    }else if(current.type!==item.type){
      closeL(listStack.length-1);
      out.push("<"+item.type+">");
      listStack.push({type:item.type,depth,itemOpen:false});
      current=listStack[listStack.length-1];
    }else if(current.itemOpen){
      out.push("</li>");
      current.itemOpen=false;
    }
    const content=item.headingLevel?headingHtml(item.headingLevel,item.content):inline(item.content);
    out.push("<li>"+content);
    current.itemOpen=true;
  };
  const headingHtml=(level:number,title:string)=>{
    const actual=Math.min(4,Math.max(2,level)),base=slugHeading(title),count=seen.get(base)||0;seen.set(base,count+1);
    const id=count?base+"-"+(count+1):base;
    return "<h"+actual+' id="'+esc(id)+'">'+inline(title)+"</h"+actual+">";
  };
  const heading=(level:number,title:string)=>out.push(headingHtml(level,title));
  const continuationIndent=(line:string)=>{
    const current=listStack[listStack.length-1],match=String(line||"").match(/^(\s+)\S/);
    return Boolean(current?.itemOpen&&match&&match[1].replace(/\t/g,"  ").length>=current.depth*2+1);
  };
  const renderLegacyNumberedHeadingList=(items:LegacyNumberedHeadingItem[])=>{
    const start=arabicIndicNumber(items[0].number);
    out.push("<ol"+(Number.isFinite(start)&&start>1?' start="'+start+'"':"")+">");
    for(const item of items){
      out.push("<li>"+headingHtml(item.level,"**"+item.title+"**"));
      let block:string[]=[];
      const flushBlock=()=>{
        if(block.length){out.push("<p>"+inline(block.join(" ").trim())+"</p>");block=[];}
      };
      for(const bodyLine of item.body){
        if(!bodyLine.trim()){flushBlock();continue;}
        block.push(bodyLine.trim());
      }
      flushBlock();
      out.push("</li>");
    }
    out.push("</ol>");
  };
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    const legacyList=code?null:parseLegacyNumberedHeadingList(lines,index);
    if(legacyList){closeP();closeL();renderLegacyNumberedHeadingList(legacyList.items);index=legacyList.endIndex;continue;}
    if(code){
      if(/^\x60{3}\s*$/.test(line)){out.push('<pre><code'+(language?' class="language-'+esc(language)+'"':"")+'>'+esc(code.join("\n"))+"</code></pre>");code=null;language="";}
      else code.push(line);continue;
    }
    const fence=line.match(/^\x60{3}\s*([a-z0-9_-]*)/i);
    if(fence){closeP();closeL();code=[];language=fence[1]||"";continue;}
    if(!line.trim()){
      closeP();
      const nextLine=lines[index+1]||"";
      if(!parseMarkdownListItem(nextLine)&&!continuationIndent(nextLine))closeL();
      continue;
    }
    const headers=tableCells(line);
    if(index+1<lines.length&&headers.length>=2&&isTableDivider(lines[index+1],headers.length)){
      closeP();closeL();
      const rows:string[][]=[];
      index+=2;
      while(index<lines.length&&lines[index].trim()){
        const row=tableCells(lines[index]);
        if(row.length!==headers.length)break;
        rows.push(row);
        index++;
      }
      index--;
      const headerHtml=headers.map((cell)=>"<th>"+inline(cell)+"</th>").join("");
      const rowHtml=rows.map((row)=>"<tr>"+row.map((cell)=>"<td>"+inline(cell)+"</td>").join("")+"</tr>").join("");
      out.push('<div class="blog-table-scroll" role="region" aria-label="جدول مقاله" tabindex="0"><table class="blog-table"><thead><tr>'+headerHtml+"</tr></thead><tbody>"+rowHtml+"</tbody></table></div>");
      continue;
    }
    const image=parseImageLine(line);
    if(image){
      closeP();closeL();
      out.push('<figure class="blog-inline-image"><img src="'+esc(image.url)+'" alt="'+esc(image.alt)+'"'+(image.title?' title="'+esc(image.title)+'"':"")+' loading="lazy" decoding="async">'+(image.caption?'<figcaption>'+esc(image.caption)+'</figcaption>':"")+"</figure>");
      continue;
    }
    if(line.trim()&&index+1<lines.length){
      const setext=lines[index+1].trim().match(/^(={3,}|-{3,})$/);
      if(setext){closeP();closeL();heading(setext[1][0]==="="?2:3,line.trim());index++;continue;}
    }
    const h=line.match(/^\s{0,3}(#{1,4})\s+(.+?)\s*#*$/);if(h){closeP();closeL();heading(h[1].length,h[2].trim());continue;}
    if(/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)){closeP();closeL();out.push("<hr>");continue;}
    const quote=line.match(/^\s*>\s?(.*)$/);
    if(quote){
      closeP();closeL();
      const quoteParagraphs:string[][]=[[]];
      while(index<lines.length){
        const quotedLine=lines[index].match(/^\s*>\s?(.*)$/);
        if(!quotedLine)break;
        const content=quotedLine[1].trim();
        if(content)quoteParagraphs[quoteParagraphs.length-1].push(content);
        else if(quoteParagraphs[quoteParagraphs.length-1].length)quoteParagraphs.push([]);
        index++;
      }
      while(quoteParagraphs.length&&!quoteParagraphs[quoteParagraphs.length-1].length)quoteParagraphs.pop();
      const quoteHtml=quoteParagraphs.map((parts)=>"<p>"+inline(parts.join(" "))+"</p>").join("");
      out.push("<blockquote>"+quoteHtml+"</blockquote>");
      index--;
      continue;
    }
    const item=parseMarkdownListItem(line);
    if(item){closeP();appendListItem(item);continue;}
    if(continuationIndent(line)){paragraph.push(line.trim());continue;}
    closeL();paragraph.push(line.trim());
  }
  closeP();closeL();if(code)out.push("<pre><code>"+esc(code.join("\n"))+"</code></pre>");
  return out.join("\n");
}
