/* 純遊戲規則，供瀏覽器與 Node 測試共用。上方為 y 減少。 */
(function(root){
const W=15,H=9;
function boardWidth(level){return Math.max(13,level.words.length*2+3);}
function start(level){const width=boardWidth(level);return {width,player:{x:Math.floor(width/2),y:7},boxes:level.order.map((id,i)=>({id,x:2+i*2,y:5})),steps:0};}
function goals(level){return level.words.map((_,i)=>({x:2+i*2,y:2}));}
function inside(x,y,width=W){return x>=1&&x<width-1&&y>=1&&y<H-1;}
function locked(state,box,level){if(!level)return false;const goal=goals(level)[box.id];return !!goal&&box.x===goal.x&&box.y===goal.y;}
function move(state,dx,dy,level){if(Math.abs(dx)+Math.abs(dy)!==1)return null;const s=JSON.parse(JSON.stringify(state));const x=s.player.x+dx,y=s.player.y+dy;if(!inside(x,y,s.width))return null;const b=s.boxes.find(b=>b.x===x&&b.y===y);if(b){if(locked(s,b,level))return null;const nx=x+dx,ny=y+dy;if(!inside(nx,ny,s.width)||s.boxes.some(c=>c.x===nx&&c.y===ny))return null;b.x=nx;b.y=ny;}s.player={x,y};s.steps++;return s;}
function pull(state,boxId,dx,dy,level){if(Math.abs(dx)+Math.abs(dy)!==1)return null;const selected=state.boxes.find(b=>b.id===boxId);if(!selected||locked(state,selected,level)||Math.abs(selected.x-state.player.x)+Math.abs(selected.y-state.player.y)!==1)return null;const x=state.player.x+dx,y=state.player.y+dy;if(!inside(x,y,state.width)||state.boxes.some(b=>b.x===x&&b.y===y))return null;const s=JSON.parse(JSON.stringify(state)),box=s.boxes.find(b=>b.id===boxId);box.x=s.player.x;box.y=s.player.y;s.player={x,y};s.steps++;return s;}
function placed(s,l){return goals(l).map(g=>s.boxes.find(b=>b.x===g.x&&b.y===g.y));}
function won(s,l){return placed(s,l).every((b,i)=>b&&b.id===i);}
function scoreAward(s,l,levelKey,earned,completed,multi=1){const slotKeys=[];if(s.steps>0)placed(s,l).forEach((b,i)=>{const key=`${levelKey}:${i}`;if(b?.id===i&&!earned.has(key))slotKeys.push(key);});const completeNow=won(s,l)&&!completed.has(levelKey);return {points:(slotKeys.length*10+(completeNow?50:0))*multi,slotKeys,completeNow};}
root.Sokoban={W,H,boardWidth,start,goals,inside,locked,move,pull,placed,won,scoreAward};
})(globalThis);


