export type TocItem={id:string;title:string;level:number};
export function slugHeading(value:string){return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,"").replace(/\s+/g,"-").replace(/-+/g,"-")||"section";}
function esc(value:string){return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));}
function allowedUrl(value:string){
  const candidate=value.trim();
  if(!candidate)return "#";
  if(candidate.startsWith("#"))return candidate;
  if(candidate.startsWith("/")&&candidate[1]!=="/"&&candidate[1]!==String.fromCharCode(92))return candidate;
  try{
    const url=new URL(candidate);
    if(["http:","https:","mailto:"].includes(url.protocol)&&!url.username&&!url.password)return candidate;
  }catch{}
  return "#";
}
function inline(value:string){
  let s=esc(value);
  s=s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,(_m,alt,url,title)=>'<img src="'+esc(allowedUrl(url.replace(/&amp;/g,"&")))+'" alt="'+alt+'"'+(title?' title="'+title+'"':"")+' loading="lazy" decoding="async">');
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(?:\{([^}]*)\})?/g,(_m,label,url,title,options)=>{
    const href=allowedUrl(url.replace(/&amp;/g,"&")),external=/^https?:\/\//i.test(href);
    const relation=(String(options||"").match(/rel=(follow|nofollow|sponsored|ugc)/i)||[])[1]||(external?"nofollow":"follow");
    const target=(String(options||"").match(/target=(_blank|_self)/i)||[])[1]||(external?"_blank":"");
    const rel=[...(relation!=="follow"?[relation]:[]),...(target==="_blank"?["noopener","noreferrer"]:[])].join(" ");
    return '<a href="'+esc(href)+'"'+(title?' title="'+esc(title)+'"':"")+(target?' target="'+target+'"':"")+(rel?' rel="'+rel+'"':"")+'>'+label+'</a>';
  });
  s=s.replace(/\x60([^\x60]+)\x60/g,"<code>$1</code>");
  s=s.replace(/\+\+([^+]+)\+\+/g,"<u>$1</u>").replace(/~~([^~]+)~~/g,"<del>$1</del>");
  s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/__([^_]+)__/g,"<strong>$1</strong>");
  s=s.replace(/\*([^*]+)\*/g,"<em>$1</em>").replace(/_([^_]+)_/g,"<em>$1</em>");
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
export function extractToc(markdown:string):TocItem[]{
  const lines=markdown.replace(/\r\n/g,"\n").split("\n");
  const seen=new Map<string,number>(),items:TocItem[]=[];
  const add=(level:number,title:string)=>{
    if(level<2||level>3)return;
    const base=slugHeading(title),count=seen.get(base)||0;seen.set(base,count+1);
    items.push({id:count?base+"-"+(count+1):base,title,level});
  };
  for(let index=0;index<lines.length;index++){
    const line=lines[index].replace(/^\s{0,3}/,"");
    const heading=line.match(/^(#{2,3})\s+(.+?)\s*#*$/);
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
export function renderMarkdown(markdown:string):string{
  const lines=markdown.replace(/\r\n/g,"\n").split("\n"),out:string[]=[];
  const seen=new Map<string,number>();let paragraph:string[]=[],list:"ul"|"ol"|null=null,code:string[]|null=null,language="";
  const closeP=()=>{if(paragraph.length){out.push("<p>"+inline(paragraph.join(" "))+"</p>");paragraph=[];}};
  const closeL=()=>{if(list){out.push("</"+list+">");list=null;}};
  const heading=(level:number,title:string)=>{
    const actual=Math.max(2,level),base=slugHeading(title),count=seen.get(base)||0;seen.set(base,count+1);
    const id=count?base+"-"+(count+1):base;out.push("<h"+actual+' id="'+esc(id)+'">'+inline(title)+"</h"+actual+">");
  };
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    if(code){
      if(/^\x60{3}\s*$/.test(line)){out.push('<pre><code'+(language?' class="language-'+esc(language)+'"':"")+'>'+esc(code.join("\n"))+"</code></pre>");code=null;language="";}
      else code.push(line);continue;
    }
    const fence=line.match(/^\x60{3}\s*([a-z0-9_-]*)/i);
    if(fence){closeP();closeL();code=[];language=fence[1]||"";continue;}
    if(!line.trim()){closeP();closeL();continue;}
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
    const quote=line.match(/^\s*>\s?(.*)$/);if(quote){closeP();closeL();out.push("<blockquote><p>"+inline(quote[1])+"</p></blockquote>");continue;}
    const un=line.match(/^\s*[-*+]\s+(.+)$/),ord=line.match(/^\s*\d+[.)]\s+(.+)$/);
    const item=un||ord;if(item){closeP();const target=un?"ul":"ol";if(list!==target){closeL();out.push("<"+target+">");list=target;}out.push("<li>"+inline(item[1])+"</li>");continue;}
    closeL();paragraph.push(line.trim());
  }
  closeP();closeL();if(code)out.push("<pre><code>"+esc(code.join("\n"))+"</code></pre>");
  return out.join("\n");
}
