import fs from "fs";
import type { Project, NodeWithEvidence, KnowledgeEdge, SourceFileRecord } from "../../shared/types";

const TYPE_COLORS: Record<string, string> = {
  principle: "#4fd1c5",
  decision: "#58a6ff",
  component: "#8b95a5",
  convention: "#d29922",
  procedure: "#bc8cff",
  dependency: "#39c5cf",
  verification: "#3fb950",
  "status-question": "#f0883e",
};

function escapeJsonForScript(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");
}

export function buildGraphReportHtml(
  project: Project,
  nodes: NodeWithEvidence[],
  edges: KnowledgeEdge[],
  files: SourceFileRecord[]
): string {
  let cytoscapeJs = "";
  try {
    cytoscapeJs = fs.readFileSync(require.resolve("cytoscape/dist/cytoscape.min.js"), "utf8");
  } catch {
    cytoscapeJs = "";
  }

  const payload = {
    project: {
      displayName: project.displayName,
      rootPath: project.rootPath,
      lastCommit: project.lastCommit,
      lastScanAt: project.lastScanAt,
    },
    types: TYPE_COLORS,
    nodes: nodes.map((n) => ({
      id: n.node.id,
      title: n.node.title,
      content: n.node.content,
      type: n.node.type,
      status: n.node.status,
      origin: n.node.origin,
      evidence: n.evidence.map((e) => ({
        sourcePath: e.sourcePath,
        startLine: e.startLine,
        endLine: e.endLine,
        excerpt: e.excerpt,
        classification: e.classification,
        confidence: e.confidence,
      })),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      relation: e.relation,
      origin: e.origin,
    })),
    files: files.map((f) => ({ path: f.relativePath, size: f.size, parseStatus: f.parseStatus })),
  };

  const json = escapeJsonForScript(JSON.stringify(payload));
  const generated = new Date().toISOString();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CarryForward graph — ${project.displayName.replace(/[<>&"]/g, "")}</title>
<style>
:root{--bg:#0e1116;--panel:#151a21;--border:#232b36;--text:#e6e9ee;--dim:#8b95a5;--accent:#4fd1c5}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.55 "Segoe UI",system-ui,sans-serif;height:100vh;display:flex;flex-direction:column}
header{padding:12px 18px;border-bottom:1px solid var(--border);display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
header h1{font-size:16px;margin:0}
header .meta{color:var(--dim);font-size:12px}
#wrap{flex:1;display:grid;grid-template-columns:1fr 340px;min-height:0}
#cy{min-width:0;height:100%}
#detail{border-left:1px solid var(--border);padding:14px 16px;overflow-y:auto;background:var(--panel)}
#detail h2{font-size:14px;margin:0 0 8px;word-break:break-word}
#detail h3{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--dim);margin:14px 0 6px}
#detail p{margin:6px 0}
.badge{display:inline-block;border:1px solid var(--border);border-radius:999px;font-size:11px;padding:1px 9px;margin-right:4px;color:var(--dim)}
.badge.approved{color:#3fb950;border-color:#1f4a29}
.badge.candidate{color:#d29922;border-color:#6e531e}
.mono{font-family:Consolas,monospace;font-size:12px;color:var(--dim)}
.excerpt{background:#0e1116;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;margin:4px 0 10px}
#controls{position:absolute;top:10px;left:10px;z-index:10;display:flex;gap:8px;flex-wrap:wrap}
#controls input,#controls select{background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 8px;font-size:12px}
#legend{position:absolute;bottom:10px;left:10px;z-index:10;display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--dim);background:rgba(14,17,22,.8);border:1px solid var(--border);border-radius:8px;padding:6px 10px}
.leg{display:inline-flex;align-items:center;gap:4px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
#toolbar{position:absolute;top:10px;right:10px;z-index:10;color:var(--dim);font-size:11px;background:rgba(14,17,22,.8);border:1px solid var(--border);border-radius:8px;padding:5px 10px}
#canvasWrap{position:relative;min-height:0}
.fileLink{display:block;background:none;border:none;color:#58a6ff;text-align:left;padding:2px 0;font-size:12px;cursor:pointer}
</style>
</head>
<body>
<header>
  <h1>CarryForward graph — ${project.displayName.replace(/[<>&"]/g, "")}</h1>
  <span class="meta">Evidence-linked project knowledge · generated ${generated} · ${payload.nodes.length} nodes · ${payload.edges.length} links${project.lastCommit ? ` · captured at commit ${project.lastCommit.slice(0, 12)}` : ""}</span>
</header>
<div id="wrap">
  <div id="canvasWrap">
    <div id="controls">
      <input id="search" placeholder="Search nodes…" aria-label="Search nodes">
      <select id="typeFilter" aria-label="Filter by type"><option value="all">All types</option></select>
    </div>
    <div id="toolbar">zoom to reveal labels · hover shows one · click for details</div>
    <div id="cy"></div>
    <div id="legend"></div>
  </div>
  <div id="detail"><p class="mono">Select a node to inspect its evidence. Solid links come from source evidence; dashed teal links were added by a person. This file is a static snapshot generated by CarryForward — the repository's files remain authoritative.</p></div>
</div>
<script>${cytoscapeJs}</script>
<script id="data" type="application/json">${json}</script>
<script>
(function(){
  var payload = JSON.parse(document.getElementById('data').textContent);
  var byId = {};
  payload.nodes.forEach(function(n){ byId[n.id] = n; });
  var connected = {};
  payload.edges.forEach(function(e){ connected[e.source]=1; connected[e.target]=1; });
  var bySource = {};
  payload.nodes.forEach(function(n){ n.evidence.forEach(function(ev){
    (bySource[ev.sourcePath] = bySource[ev.sourcePath] || []).push({node:n, ev:ev});
  });});

  var typeFilter = document.getElementById('typeFilter');
  Object.keys(payload.types).forEach(function(t){
    var o=document.createElement('option'); o.value=t; o.textContent=t; typeFilter.appendChild(o);
  });
  var search = document.getElementById('search');
  var showAll = false;

  function visible(n){
    if(!showAll && n.type==='dependency') return false;
    if(!showAll && !connected[n.id]) return false;
    if(typeFilter.value!=='all' && n.type!==typeFilter.value) return false;
    if(search.value && n.title.toLowerCase().indexOf(search.value.toLowerCase())<0) return false;
    return true;
  }

  function build(){
    var els=[];
    payload.nodes.forEach(function(n){
      if(!visible(n)) return;
      els.push({data:{id:n.id,label:n.title.length>30?n.title.slice(0,28)+'…':n.title,
        color:payload.types[n.type]||'#8b95a5',approved:n.status==='user-approved'}});
    });
    payload.edges.forEach(function(e){
      if(!byId[e.source]||!byId[e.target]) return;
      if(!visible(byId[e.source])||!visible(byId[e.target])) return;
      els.push({data:{id:e.id,source:e.source,target:e.target,userOrigin:e.origin==='user'}});
    });
    return els;
  }

  var cy = cytoscape({
    container: document.getElementById('cy'),
    elements: build(),
    wheelSensitivity: 0.25,
    style: [
      {selector:'node',style:{label:'data(label)','background-color':'data(color)',color:'#e6e9ee','font-size':9,
        width:22,height:22,'border-width':3,'border-color':'#232b36','text-valign':'bottom','text-margin-y':6,
        'text-wrap':'ellipsis','text-max-width':'140px','transition-property':'text-opacity','transition-duration':150}},
      {selector:'node.hideLabel',style:{'text-opacity':0}},
      {selector:'node[approved]',style:{'border-color':'#3fb950'}},
      {selector:'edge',style:{width:1.5,'line-color':'#313c4a','target-arrow-color':'#313c4a','target-arrow-shape':'triangle','curve-style':'bezier'}},
      {selector:'edge[userOrigin]',style:{'line-color':'#4fd1c5','target-arrow-color':'#4fd1c5','line-style':'dashed'}},
      {selector:'node:selected',style:{'border-color':'#4fd1c5','border-width':4}}
    ],
    layout:{name:'cose',animate:false,padding:30,nodeDimensionsIncludeLabels:true,componentSpacing:90,nodeRepulsion:9000,idealEdgeLength:90}
  });

  function applyLabels(){
    var z=cy.zoom();
    cy.batch(function(){
      cy.nodes().forEach(function(n){
        n.toggleClass('hideLabel', z<1.15 && !n.data('approved') && !n.selected());
      });
    });
  }
  cy.on('zoom', applyLabels);
  cy.on('mouseover','node',function(ev){ev.target.removeClass('hideLabel');});
  cy.on('mouseout','node',function(ev){ applyLabels(); });
  cy.on('tap','node',function(ev){ select(ev.target.id()); });

  var detail=document.getElementById('detail');
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
  function select(id){
    var n=byId[id]; if(!n) return;
    cy.elements().unselect(); cy.getElementById(id).select();
    var h='<h2>'+esc(n.title)+'</h2>';
    h+='<div><span class="badge">'+n.type+'</span><span class="badge '+(n.status==='user-approved'?'approved':n.status==='candidate'?'candidate':'')+'">'+n.status+'</span>'+(n.origin==='user'?'<span class="badge">user-authored</span>':'')+'</div>';
    h+='<p>'+esc(n.content)+'</p><h3>Evidence</h3>';
    if(n.evidence.length===0){h+='<p class="mono">No source evidence — user-authored node.</p>';}
    n.evidence.forEach(function(ev){
      h+='<div class="mono">'+esc(ev.sourcePath)+':'+ev.startLine+(ev.endLine!==ev.startLine?'–'+ev.endLine:'')+' · '+ev.classification+' · confidence '+ev.confidence+'</div><pre class="excerpt">'+esc(ev.excerpt)+'</pre>';
    });
    if(n.type==='component'){
      var compName=n.title.replace(/^Component: /,'').replace(/\\/$/,'');
      var dirFiles=payload.files.filter(function(f){return f.path===compName||f.path.indexOf(compName+'/')===0;});
      h+='<h3>Files in this folder ('+dirFiles.length+')</h3>';
      dirFiles.slice(0,100).forEach(function(f){
        h+='<button class="fileLink" data-file="'+esc(f.path)+'">'+esc(f.path)+'</button>';
      });
    }
    detail.innerHTML=h;
    detail.querySelectorAll('.fileLink').forEach(function(btn){
      btn.addEventListener('click',function(){
        var path=btn.getAttribute('data-file');
        var contribs=bySource[path]||[];
        var fh='<h2 class="mono">'+esc(path)+'</h2><h3>Knowledge contributed by this file</h3>';
        if(contribs.length===0){fh+='<p class="mono">No extracted rules or decisions came from this file.</p>';}
        contribs.forEach(function(c){
          fh+='<div><span class="badge '+(c.node.status==='user-approved'?'approved':c.node.status==='candidate'?'candidate':'')+'">'+c.node.status+'</span><span class="badge">'+c.node.type+'</span></div><button class="fileLink" data-node="'+c.node.id+'">'+esc(c.node.title)+'</button><div class="mono">'+esc(c.ev.sourcePath)+':'+c.ev.startLine+' · '+c.ev.classification+'</div><br>';
        });
        detail.innerHTML=fh;
        detail.querySelectorAll('.fileLink').forEach(function(b2){
          b2.addEventListener('click',function(){ if(b2.getAttribute('data-node')) select(b2.getAttribute('data-node')); });
        });
      });
    });
  }

  search.addEventListener('input',function(){ relayout(); });
  typeFilter.addEventListener('change',function(){ relayout(); });

  function relayout(){
    cy.elements().remove();
    cy.add(build());
    cy.layout({name:'cose',animate:false,padding:30,nodeDimensionsIncludeLabels:true,componentSpacing:90,nodeRepulsion:9000,idealEdgeLength:90}).run();
    applyLabels();
  }

  var legend=document.getElementById('legend');
  var lh='';
  Object.keys(payload.types).forEach(function(t){
    lh+='<span class="leg"><span class="dot" style="background:'+payload.types[t]+'"></span>'+t+'</span>';
  });
  lh+='<span class="leg"><span class="dot" style="border:2px solid #3fb950;background:#151a21"></span>approved</span>';
  legend.innerHTML=lh;

  applyLabels();
})();
</script>
</body>
</html>`;
}
