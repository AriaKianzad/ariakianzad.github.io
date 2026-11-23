export type TocItem={id:string;title:string;level:number};
export function slugHeading(value:string){return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,"").replace(/\s+/g,"-").replace(/-+/g,"-")||"section";}
function esc(value:string){return value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));}
function allowedUrl(value:string){const v=value.trim();return /^(https?:\/\/|mailto:|\/|#)/i.test(v)&&!/^\/\//.test(v)?v:"#";}
function inline(value:string){
  let s=esc(value);
  s=s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,(_m,alt,url,title)=>'<img src="'+esc(allowedUrl(url.replace(/&amp;/g,"&")))+'" alt="'+alt+'"'+(title?' title="'+title+'"':"")+' loading="lazy" decoding="async">');
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(?:\{([^}]*)\})?/g,(_m,label,url,title,options)=>{
    const href=allowedUrl(url.replace(/&amp;/g,"&")),external=/^https?:\/\//i.test(href);
    const relation=(String(options||"").match(/rel=(follow|nofollow|sponsored|ugc)/i)||[])[1]||"follow";
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
export function extractToc(markdown:string):TocItem[]{
  const seen=new Map<string,number>(),items:TocItem[]=[];
  for(const line of markdown.split(/\r?\n/)){
    const m=line.match(/^(#{2,3})\s+(.+?)\s*#*$/);if(!m)continue;
    const title=m[2].trim(),base=slugHeading(title),count=seen.get(base)||0;seen.set(base,count+1);
    items.push({id:count?base+"-"+(count+1):base,title,level:m[1].length});
  }
  return items;
}
function tableCells(line:string){return line.trim().replace(/^\||\|$/g,"").split("|").map((cell)=>cell.trim());}
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
    if(/^\s*\|?.+\|.+\|?\s*$/.test(line)&&index+1<lines.length&&/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index+1])){
      closeP();closeL();
      const headers=tableCells(line);const rows:string[][]=[];
      index+=2;
      while(index<lines.length&&/^\s*\|?.+\|.+\|?\s*$/.test(lines[index])){rows.push(tableCells(lines[index]));index++;}
      index--;
      out.push("<table><thead><tr>"+headers.map((cell)=>"<th>"+inline(cell)+"</th>").join("")+"</tr></thead><tbody>"+rows.map((row)=>"<tr>"+row.map((cell)=>"<td>"+inline(cell)+"</td>").join("")+"</tr>").join("")+"</tbody></table>");
      continue;
    }
    const h=line.match(/^(#{1,4})\s+(.+?)\s*#*$/);if(h){closeP();closeL();heading(h[1].length,h[2].trim());continue;}
    if(/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)){closeP();closeL();out.push("<hr>");continue;}
    const quote=line.match(/^\s*>\s?(.*)$/);if(quote){closeP();closeL();out.push("<blockquote><p>"+inline(quote[1])+"</p></blockquote>");continue;}
    const un=line.match(/^\s*[-*+]\s+(.+)$/),ord=line.match(/^\s*\d+[.)]\s+(.+)$/);
    const item=un||ord;if(item){closeP();const target=un?"ul":"ol";if(list!==target){closeL();out.push("<"+target+">");list=target;}out.push("<li>"+inline(item[1])+"</li>");continue;}
    closeL();paragraph.push(line.trim());
  }
  closeP();closeL();if(code)out.push("<pre><code>"+esc(code.join("\n"))+"</code></pre>");
  return out.join("\n");
}
