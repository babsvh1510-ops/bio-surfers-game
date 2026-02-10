
// Console polyfill zodat 'console' fouten nooit de game breken
window.console = window.console || {log:function(){}, warn:function(){}, error:function(){}};

/******************************************************
 * BIO-SURFERS – Thema 13: Transport & Afweer
 * Pseudo‑3D lane runner met 6 levels (13.1 t/m 13.6)
 * Besturing: ← → (banen), Spatie (sprong), P (pauze)
 * Visuals: Auto-modus (icons op pc, blokjes op mobiel) – omschakelbaar
 ******************************************************/

/* ---------- DOM refs ---------- */
const startScreen = document.getElementById("startScreen");
const levelButtons = startScreen.querySelectorAll(".levels button");
const startDefaultBtn = document.getElementById("startDefault");
const toggleVisualBtn = document.getElementById("toggleVisual");

const hudLevel = document.getElementById("levelName");
const hudScore = document.getElementById("score");
const hudLives = document.getElementById("lives");
const hudObjective = document.getElementById("objective");

const gameArea = document.getElementById("gameArea");
const playerEl = document.getElementById("player");

const factCard = document.getElementById("factCard");
const factText = document.getElementById("factText");
const factOk = document.getElementById("factOk");

const quizCard = document.getElementById("quizCard");
const quizQuestion = document.getElementById("quizQuestion");
const quizOptions = document.getElementById("quizOptions");
const quizFeedback = document.getElementById("quizFeedback");
const quizNext = document.getElementById("quizNext");

const levelComplete = document.getElementById("levelComplete");
const levelSummary = document.getElementById("levelSummary");
const nextLevelBtn = document.getElementById("nextLevel");
const backMenuBtn = document.getElementById("backMenu");

const gameOver = document.getElementById("gameOver");
const gameOverText = document.getElementById("gameOverText");
const retryLevelBtn = document.getElementById("retryLevel");
const goMenuBtn = document.getElementById("goMenu");

/* ---------- Game State ---------- */
const lanes = ["calc(14% - 37px)","calc(50% - 37px)","calc(86% - 37px)"];
let currentLevel = 0;
let score = 0;
let lives = 3;
let playerLane = 1;
let isJumping = false;
let jumpT = 0;
let running = false;
let paused = false;
let rafId = null;
let spawnTimers = [];
let activeEntities = [];

let objective = {needItems:0, gotItems:0, needQuiz:0, gotQuiz:0};
let quizIndex = 0;
let factIndex = 0;

// Auto visual mode: icons op pc, blokjes op mobiel
function detectAutoVisual(){
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return !isMobile; // true = icons, false = blocks
}
let useIcons = detectAutoVisual();
function updateVisualToggleLabel(){
  toggleVisualBtn.textContent = 'Weergave: ' + (useIcons? 'Iconen' : 'Blokjes');
}
updateVisualToggleLabel();

toggleVisualBtn.addEventListener('click',()=>{
  // wissel tussen auto-modi: Iconen ↔ Blokjes
  useIcons = !useIcons; updateVisualToggleLabel();
});

/* ---------- Utility ---------- */
const rng = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const clamp = (v,min,max)=>Math.min(max,Math.max(min,v));
function setOverlay(el, show) { el.classList.toggle("visible", !!show); }
function setHUD() {
  hudLevel.textContent = `Level: ${levels[currentLevel-1].title}`;
  hudScore.textContent = `Score: ${score}`;
  hudLives.textContent = "❤️".repeat(lives) + "🖤".repeat(3-lives);
  hudObjective.textContent = `Doel: items ${objective.gotItems}/${objective.needItems} • quiz ${objective.gotQuiz}/${objective.needQuiz}`;
}
function clearEntities() {
  activeEntities.forEach(e=>e.el.remove());
  activeEntities.length=0;
  spawnTimers.forEach(t=>clearInterval(t));
  spawnTimers.length=0;
  cancelAnimationFrame(rafId);
}

/* ---------- Level Configs ---------- */
const levels = [
  {
    id:1,
    title:"13.1 Bloed",
    cssClass:"level-1",
    bg:"radial-gradient(1000px 500px at 50% 120%, #240810 10%, #18060c 60%, #10040a 100%)",
    objective:{needItems:12, needQuiz:3},
    items:[
      {key:"rbc", icon:"🩸", label:"RBC", tag:"rode bloedcel", css:"", score:2, fact:"Rode bloedcellen vervoeren zuurstof met hemoglobine."},
      {key:"wbc", icon:"🦠", label:"WBC", tag:"witte bloedcel", css:"wbc", score:3, fact:"Witte bloedcellen bestrijden ziekteverwekkers (afweer)."},
      {key:"plt", icon:"🧩", label:"PLT", tag:"bloedplaatje", css:"plt", score:2, fact:"Bloedplaatjes helpen bij de bloedstolling."},
      {key:"plasma", icon:"💧", label:"H2O", tag:"plasma", css:"plasma", score:1, fact:"Bloedplasma bestaat vooral uit water en vervoert o.a. voedings‑ en afvalstoffen."}
    ],
    obstacles:[
      {key:"pathogen", icon:"🧫", label:"", tag:"pathogeen", css:"pathogen", dmg:1}
    ],
    quiz:[
      {q:"Welke bloedcel komt het meest voor?",opts:["Witte bloedcel","Rode bloedcel","Bloedplaatje"],a:1,exp:"Rode bloedcellen zijn met afstand het talrijkst."},
      {q:"Wat is de hoofdtaak van bloedplaatjes?",opts:["Zuurstof vervoeren","Afweer","Bloedstolling"],a:2,exp:"Bloedplaatjes starten de stolling en vormen een stolsel."},
      {q:"Waaruit bestaat bloedplasma vooral?",opts:["Water","Glucose","Zouten"],a:0,exp:"Plasma is voornamelijk water met o.a. opgeloste stoffen/eiwitten."}
    ]
  },
  {
    id:2,
    title:"13.2 Dubbele bloedsomloop & bloedvaten",
    cssClass:"level-2",
    bg:"radial-gradient(1000px 500px at 50% 120%, #081924 10%, #06181b 60%, #031015 100%)",
    objective:{needItems:14, needQuiz:4},
    items:[
      {key:"artery", icon:"➡️", label:"A", tag:"slagader", css:"artery", score:2, fact:"Slagaders voeren bloed van het hart weg; dikke, elastische wanden."},
      {key:"vein", icon:"⬅️", label:"V", tag:"ader", css:"vein", score:2, fact:"Aders voeren bloed naar het hart en hebben vaak kleppen."},
      {key:"cap", icon:"🔁", label:"CAP", tag:"haarvat", css:"cap", score:2, fact:"Haarvaten zijn dunwandig; hier vindt stoffenwisseling plaats."}
    ],
    obstacles:[
      {key:"clot", icon:"🩹", label:"", tag:"bloedprop", css:"clot", dmg:1}
    ],
    quiz:[
      {q:"In welke bloedsomloop wordt zuurstof opgenomen?",opts:["Grote bloedsomloop","Kleine bloedsomloop"],a:1,exp:"In de kleine bloedsomloop (hart–longen–hart) neemt bloed O₂ op."},
      {q:"Welk bloedvat heeft meestal kleppen?",opts:["Slagader","Ader","Haarvat"],a:1,exp:"Aders hebben vaak kleppen om terugstromen te voorkomen."},
      {q:"Wat is de functie van haarvaten?",opts:["Snel transport","Stoffen uitwisselen","Bloed stollen"],a:1,exp:"Door dunne wanden is er uitwisseling met weefsels."},
      {q:"Wat vervoert de grote bloedsomloop vooral naar organen?",opts:["Zuurstofrijk bloed","Zuurstofarm bloed"],a:0,exp:"Vanuit linkerkamer via aorta naar organen: meestal O₂‑rijk."}
    ]
  },
  {
    id:3,
    title:"13.3 Hart & hartslag",
    cssClass:"level-3",
    bg:"radial-gradient(1000px 500px at 50% 120%, #241018 10%, #1b0e16 60%, #100611 100%)",
    objective:{needItems:10, needQuiz:4},
    items:[
      {key:"heartpart", icon:"🫀", label:"LA", tag:"linkerboezem", css:"heartpart", score:1, fact:"Boezems ontvangen bloed; kamers pompen bloed weg."},
      {key:"heartpart", icon:"🫀", label:"LV", tag:"linkerkamer", css:"heartpart", score:2, fact:"Linkerkamer pompt O₂‑rijk bloed de aorta in (hoge druk)."},
      {key:"heartpart", icon:"🫀", label:"RV", tag:"rechterkamer", css:"heartpart", score:2, fact:"Rechterkamer pompt bloed naar de longslagader (kleine kring)."},
      {key:"heartpart", icon:"🩺", label:"CA", tag:"kransslag", css:"heartpart", score:2, fact:"Kransslagaders voorzien de hartspier van zuurstof en voeding."}
    ],
    obstacles:[
      {key:"valve", icon:"🚫", label:"", tag:"klep‑sluiting", css:"valve", dmg:1}
    ],
    quiz:[
      {q:"Welke kamer pompt bloed naar de longen?",opts:["Linkerkamer","Rechterkamer"],a:1,exp:"Rechterkamer → longslagader → longen."},
      {q:"Volgorde hartslag (vereenvoudigd):",opts:["Vullen → Samentrekken → Rust","Rust → Vullen → Samentrekken"],a:0,exp:"Eerst vullen, dan systole (pompen), dan korte rust."},
      {q:"Wat is de aorta?",opts:["Grote ader van het hart","Grote slagader van het hart"],a:1,exp:"De aorta is de grootste slagader, vertrekt uit de linkerkamer."},
      {q:"Wat doen hartkleppen?",opts:["Ze laten bloed beide kanten op","Voorkomen terugstromen"],a:1,exp:"Kleppen zorgen voor doorstroming in één richting."}
    ]
  },
  {
    id:4,
    title:"13.4 Hart‑ en vaatziekten",
    cssClass:"level-4",
    bg:"radial-gradient(1000px 500px at 50% 120%, #1c1808 10%, #141108 60%, #0a0904 100%)",
    objective:{needItems:10, needQuiz:4},
    items:[
      {key:"healthy", icon:"🏃", label:"🏃", tag:"bewegen", css:"healthy", score:2, fact:"Regelmatig bewegen verlaagt de kans op hart‑ en vaatziekten."},
      {key:"healthy", icon:"🥗", label:"🥗", tag:"gezonde voeding", css:"healthy", score:2, fact:"Onverzadigde vetten/vezels helpen; minder verzadigd vet/zout."},
      {key:"healthy", icon:"🚭", label:"🚭", tag:"niet roken", css:"healthy", score:3, fact:"Stoppen met roken verlaagt snel het cardiovasculaire risico."}
    ],
    obstacles:[
      {key:"plaque", icon:"🟡", label:"", tag:"plaque", css:"plaque", dmg:1},
      {key:"smoke", icon:"💨", label:"", tag:"rook", css:"smoke", dmg:1}
    ],
    quiz:[
      {q:"Wat gebeurt er bij slagaderverkalking?",opts:["Vaten slibben dicht door plaques","Vaten worden wijder"],a:0,exp:"Atherosclerose: ophoping van vetten/cholesterol in de vaatwand."},
      {q:"Welke keuze verlaagt je risico het meest?",opts:["Roken","Bewegen","Veel zout eten"],a:1,exp:"Bewegen is beschermend; roken en veel zout verhogen risico."},
      {q:"Wat kan een bloedprop veroorzaken?",opts:["Hartinfarct/beroerte","Meer uithoudingsvermogen"],a:0,exp:"Een stolsel dat een vat afsluit kan infarct/beroerte geven."},
      {q:"Welke factor verlaag je via voeding?",opts:["LDL‑cholesterol","Aantal hartkleppen"],a:0,exp:"Voeding kan LDL beïnvloeden, niet het aantal hartkleppen."}
    ]
  },
  {
    id:5,
    title:"13.5 Weefselvloeistof & lymfe",
    cssClass:"level-5",
    bg:"radial-gradient(1000px 500px at 50% 120%, #08241b 10%, #081a14 60%, #04110c 100%)",
    objective:{needItems:12, needQuiz:3},
    items:[
      {key:"tf", icon:"💧", label:"TF", tag:"weefselvloeistof", css:"tf", score:2, fact:"Weefselvloeistof levert O₂/voeding aan cellen en neemt afval op."},
      {key:"lymph", icon:"🌀", label:"LY", tag:"lymfe", css:"lymph", score:2, fact:"Lymfe is weefselvloeistof in lymfevaten; stroomt terug naar bloed."},
      {key:"node", icon:"🛡️", label:"LN", tag:"lymfeklier", css:"node", score:3, fact:"Lymfeklieren filteren lymfe en bevatten veel afweercellen."}
    ],
    obstacles:[
      {key:"edema", icon:"💧", label:"", tag:"oedeem", css:"edema", dmg:1}
    ],
    quiz:[
      {q:"Waarin verandert weefselvloeistof wanneer het lymfevaten binnengaat?",opts:["Bloed","Lymfe"],a:1,exp:"In lymfevaten heet de vloeistof lymfe."},
      {q:"Wat is een functie van lymfeklieren?",opts:["Bloed stollen","Lymfe filteren en afweer"],a:1,exp:"Lymfeklieren filteren en bevatten lymfocyten."},
      {q:"Waar komt lymfe uiteindelijk terecht?",opts:["In de aders","In de slagaders"],a:0,exp:"Lymfe mondt uit in grote aders nabij het sleutelbeen."}
    ]
  },
  {
    id:6,
    title:"13.6 Afweer, immuniteit & allergieën",
    cssClass:"level-6",
    bg:"radial-gradient(1000px 500px at 50% 120%, #1a0d2a 10%, #120a20 60%, #0a0615 100%)",
    objective:{needItems:14, needQuiz:4},
    items:[
      {key:"antibody", icon:"🧷", label:"Ig", tag:"antistof", css:"antibody", score:2, fact:"Antistoffen binden aan antigenen en helpen pathogenen uitschakelen."},
      {key:"vaccine", icon:"💉", label:"V", tag:"vaccin", css:"vaccine", score:3, fact:"Vaccinatie wekt actieve, verworven immuniteit op."},
      {key:"memory", icon:"🧠", label:"M", tag:"geheugencel", css:"memory", score:3, fact:"Geheugencellen zorgen voor snellere reactie bij herbesmetting."},
      {key:"antihist", icon:"🚫", label:"AH", tag:"antihistamine", css:"antihist", score:2, fact:"Antihistamine kan klachten bij allergie verminderen."}
    ],
    obstacles:[
      {key:"allergen", icon:"🌼", label:"", tag:"allergeen", css:"allergen", dmg:1}
    ],
    quiz:[
      {q:"Wat is actieve immuniteit?",opts:["Je krijgt antistoffen binnen","Je lichaam maakt zelf antistoffen"],a:1,exp:"Bij vaccinatie maakt je lichaam zelf antistoffen (actief)."},
      {q:"Wat veroorzaakt allergische klachten direct?",opts:["Histamine","Glucose"],a:0,exp:"Histamine zorgt o.a. voor jeuk/zwelling/roodheid."},
      {q:"Wat is passieve immuniteit?",opts:["Antistoffen van buitenaf","Antistoffen zelf maken"],a:0,exp:"Bijv. antiserum of via placenta/borstvoeding."},
      {q:"Antigenen zijn…",opts:["Moleculen die afweer opwekken","Medicijnen tegen allergie"],a:0,exp:"Antigenen wekken een specifieke afweerreactie op."}
    ]
  }
];

/* ---------- Input ---------- */
document.addEventListener("keydown",(e)=>{
  if(!running) return;
  if(e.key==="ArrowLeft"){ playerLane = clamp(playerLane-1,0,2); }
  if(e.key==="ArrowRight"){ playerLane = clamp(playerLane+1,0,2); }
  if(e.code==="Space"){ startJump(); }
  if(e.key.toLowerCase()==="p"){ togglePause(); }
  updatePlayerPos();
});

levelButtons.forEach(btn=>btn.addEventListener("click",()=>{
  const lvl = parseInt(btn.dataset.level,10);
  startLevel(lvl);
}));
startDefaultBtn.addEventListener("click",()=>startLevel(1));

/* ---------- Pause ---------- */
function togglePause(){
  if(!running) return;
  paused = !paused;
  if(!paused) loop();
}

/* ---------- Player ---------- */
function updatePlayerPos(){ playerEl.style.left = lanes[playerLane]; }
function startJump(){ if(isJumping) return; isJumping = true; jumpT = 0; }
function updateJump(dt){
  if(!isJumping) return;
  jumpT += dt * 2.2;
  const phase = Math.min(Math.PI, jumpT);
  const h = Math.sin(phase) * 170;
  playerEl.style.bottom = `calc(12% + ${h}px)`;
  if(phase >= Math.PI){ isJumping=false; playerEl.style.bottom = "12%"; }
}

/* ---------- Entity Factory ---------- */
function makeEntityInner(data){
  const iconOrLabel = useIcons && data.icon ? `<div class="icon">${data.icon}</div>` : `<span>${data.label||""}</span>`;
  return `${iconOrLabel}<div class="tag">${data.tag||""}</div>`;
}
function spawnEntity(type, lane, speed, data){
  const el = document.createElement("div");
  el.className = `entity ${type} ${data.css||""}`;
  el.style.left = lanes[lane];
  el.style.top = "-120px";
  el.innerHTML = makeEntityInner(data);
  gameArea.appendChild(el);
  const entity = {el, type, lane, z: -120, speed, data, alive:true};
  activeEntities.push(entity);
  return entity;
}

/* ---------- Collisions ---------- */
function isColliding(a,b){
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  return !(ra.right<rb.left || ra.left>rb.right || ra.bottom<rb.top || ra.top>rb.bottom);
}

/* ---------- Spawning per level ---------- */
function startSpawners(){
  const L = levels[currentLevel-1];
  // Items
  spawnTimers.push(setInterval(()=>{
    if(paused) return;
    const lane = rng(0,2);
    const item = L.items[rng(0, L.items.length-1)];
    spawnEntity("item", lane, rng(4,6), item);
  }, 900));
  // Obstakels
  spawnTimers.push(setInterval(()=>{
    if(paused) return;
    const lane = rng(0,2);
    const obs = L.obstacles[rng(0, L.obstacles.length-1)];
    spawnEntity("obstacle", lane, rng(5,7), obs);
  }, 1300));
  // Wissel facts / quiz
  spawnTimers.push(setInterval(()=>{
    if(paused) return;
    const roll = Math.random();
    if(roll<0.5) showFact(); else showQuiz();
  }, 8000));
}

/* ---------- Facts ---------- */
function showFact(){
  const L = levels[currentLevel-1];
  const allFacts = L.items.map(i=>i.fact).filter(Boolean);
  if(allFacts.length===0) return;
  const f = allFacts[factIndex % allFacts.length];
  factIndex++;
  pauseForOverlay();
  factText.textContent = f;
  setOverlay(factCard, true);
}
factOk.addEventListener("click",()=>{ setOverlay(factCard, false); resumeFromOverlay(); });

/* ---------- Quiz ---------- */
function showQuiz(){
  const L = levels[currentLevel-1];
  const q = L.quiz[quizIndex % L.quiz.length];
  quizIndex++;
  pauseForOverlay();
  quizFeedback.textContent = "";
  quizQuestion.textContent = q.q;
  quizOptions.innerHTML = "";
  quizNext.disabled = true;
  q.opts.forEach((opt,idx)=>{
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.addEventListener("click",()=>{
      [...quizOptions.children].forEach(b=>b.disabled=true);
      if(idx===q.a){
        quizFeedback.textContent = "✅ Juist! " + (q.exp || "");
        quizFeedback.style.color = "#7CFC8A";
        score += 5; objective.gotQuiz++;
      }else{
        quizFeedback.textContent = "❌ Onjuist. " + (q.exp || "");
        quizFeedback.style.color = "#ff8080";
        loseLife(1);
      }
      setHUD();
      quizNext.disabled = false;
    });
    quizOptions.appendChild(btn);
  });
  quizNext.onclick = ()=>{ setOverlay(quizCard,false); resumeFromOverlay(); };
  setOverlay(quizCard,true);
}

function pauseForOverlay(){ paused = true; }
function resumeFromOverlay(){ paused = false; loop(); }

/* ---------- Level Flow ---------- */
function startLevel(lvl){
  document.body.className = "";
  clearEntities();
  lives = 3; score = 0; playerLane = 1; isJumping=false; paused=false;
  objective = { ...levels[lvl-1].objective, gotItems:0, gotQuiz:0 };
  factIndex = 0; quizIndex = 0;
  currentLevel = lvl;
  const L = levels[currentLevel-1];
  gameArea.style.background = L.bg;
  document.body.classList.add(L.cssClass);
  updatePlayerPos();
  setHUD();
  setOverlay(startScreen,false);
  setOverlay(levelComplete,false);
  setOverlay(gameOver,false);
  running = true; startSpawners(); loop();
}

function completeLevel(){
  running = false; paused = true;
  levelSummary.textContent = `Punten: ${score} • Items: ${objective.gotItems}/${objective.needItems} • Quiz: ${objective.gotQuiz}/${objective.needQuiz}`;
  setOverlay(levelComplete,true);
  nextLevelBtn.disabled = (currentLevel===6);
}
nextLevelBtn.addEventListener("click",()=>{ setOverlay(levelComplete,false); startLevel(currentLevel+1); });
backMenuBtn.addEventListener("click",()=>{ setOverlay(levelComplete,false); setOverlay(startScreen,true); });

function gameOverScreen(reason){ running = false; paused = true; gameOverText.textContent = reason; setOverlay(gameOver,true); }
retryLevelBtn.addEventListener("click",()=>{ setOverlay(gameOver,false); startLevel(currentLevel); });
goMenuBtn.addEventListener("click",()=>{ setOverlay(gameOver,false); setOverlay(startScreen,true); });

/* ---------- Lives ---------- */
function loseLife(n=1){ lives = Math.max(0, lives-n); if(lives<=0){ gameOverScreen("Je levens zijn op. Probeer het nog eens!"); } }

/* ---------- Main Loop ---------- */
let last = 0;
function loop(ts=0){
  if(!running || paused) return;
  const dt = (ts - last)/1000 || 0.016;
  last = ts;
  for(let i=activeEntities.length-1; i>=0; i--){
    const e = activeEntities[i]; if(!e.alive) continue;
    e.z += e.speed + (0.4 * currentLevel);
    e.el.style.top = `${e.z}px`;
    // collision
    const collide = isColliding(playerEl, e.el);
    if(collide){
      if(e.type==="item"){
        score += e.data.score||1; objective.gotItems++;
        e.alive=false; e.el.remove();
        if(Math.random()<0.33) showFact();
      }else if(e.type==="obstacle"){
        const pb = parseFloat(getComputedStyle(playerEl).bottom);
        if(pb < 100){ loseLife(e.data.dmg||1); }
        e.alive=false; e.el.remove();
      }
      setHUD();
    }
    if(e.z > window.innerHeight + 140){ e.alive=false; e.el.remove(); activeEntities.splice(i,1); }
  }
  if(objective.gotItems >= objective.needItems && objective.gotQuiz >= objective.needQuiz){ clearEntities(); completeLevel(); return; }
  updateJump(dt);
  rafId = requestAnimationFrame(loop);
}

/* ---------- Lane stripes (cosmetic) ---------- */
(function addLaneTexture(){
  const stripeContainer = document.createElement("div");
  stripeContainer.style.position="absolute";
  stripeContainer.style.left="0"; stripeContainer.style.right="0";
  stripeContainer.style.top="0"; stripeContainer.style.bottom="0";
  stripeContainer.style.pointerEvents="none";
  for(let i=0;i<28;i++){
    const s = document.createElement("div");
    s.style.position="absolute"; s.style.left="calc(50% - 6px)";
    s.style.width="12px"; s.style.height="60px"; s.style.background="rgba(255,255,255,.06)";
    s.style.top = `${i*240}px`; s.style.borderRadius="6px";
    stripeContainer.appendChild(s);
  }
  gameArea.appendChild(stripeContainer);
})();

// Kleine rooktest voor gebruiker (zonder console)
(function(){
  const banner = document.createElement('div');
  banner.textContent = 'Game klaar – veel succes! ✅';
  banner.style.cssText = 'position:fixed;bottom:16px;left:16px;background:#141a2a;color:#ffd200;padding:8px 12px;border-radius:8px;font-weight:bold;box-shadow:0 6px 18px rgba(0,0,0,.35);z-index:60';
  document.body.appendChild(banner);
  setTimeout(()=>banner.remove(), 2200);
})();
