// ============================================================
// AUDIO SYSTEM (Web Audio API — no external files)
// ============================================================
let _audioCtx = null;
function getAudioCtx(){
  if(!_audioCtx){
    try { _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
  }
  if(_audioCtx && _audioCtx.state==='suspended') _audioCtx.resume();
  return _audioCtx;
}

function playTone(freq, type, duration, volume, decay){
  const ctx = getAudioCtx(); if(!ctx) return;
  if(typeof _sfxVolume !== 'undefined' && _sfxVolume <= 0) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type||'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    const vol = (volume||0.12) * (typeof _sfxVolume !== 'undefined' ? _sfxVolume : 1);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+(decay||duration||0.15));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime+(duration||0.15));
  } catch(e){}
}

function playNoise(duration, volume){
  const ctx = getAudioCtx(); if(!ctx) return;
  if(typeof _sfxVolume !== 'undefined' && _sfxVolume <= 0) return;
  try {
    const bufSize = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0; i<bufSize; i++) data[i] = Math.random()*2-1;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 800;
    src.buffer = buf;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    const vol = (volume||0.08) * (typeof _sfxVolume !== 'undefined' ? _sfxVolume : 1);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+duration);
    src.start(); src.stop(ctx.currentTime+duration);
  } catch(e){}
}

const SFX = {
  hit:      ()=>{ playTone(180,'square',0.08,0.14,0.08); playNoise(0.06,0.06); },
  playerHit:()=>{ playTone(100,'sawtooth',0.12,0.18,0.10); playNoise(0.08,0.10); },
  swing:    ()=>{ playTone(320,'square',0.05,0.07,0.05); playTone(220,'square',0.07,0.05,0.07); },
  roll:     ()=>{ playTone(260,'sine',0.07,0.06,0.07); },
  heal:     ()=>{ playTone(440,'sine',0.12,0.10,0.12); setTimeout(()=>playTone(550,'sine',0.10,0.10,0.10),80); },
  magic:    ()=>{ playTone(660,'sine',0.08,0.10,0.06); playTone(880,'triangle',0.08,0.08,0.08); },
  parry:    ()=>{ playTone(500,'square',0.05,0.16,0.05); playTone(700,'square',0.05,0.12,0.07); },
  crit:     ()=>{ playTone(150,'sawtooth',0.15,0.22,0.14); playNoise(0.10,0.12); },
  death:    ()=>{ playTone(80,'sawtooth',0.4,0.15,0.4); setTimeout(()=>playTone(60,'sawtooth',0.5,0.12,0.5),200); },
  victory:  ()=>{ [440,550,660,880].forEach((f,i)=>setTimeout(()=>playTone(f,'sine',0.3,0.12,0.3),i*120)); },
  phase2:   ()=>{ playTone(60,'sawtooth',0.6,0.18,0.6); playNoise(0.3,0.15); },
  menuClick:()=>{ playTone(440,'square',0.04,0.08,0.04); },
  menuBack: ()=>{ playTone(330,'square',0.04,0.07,0.04); },
  souls:    ()=>{ playTone(550,'sine',0.1,0.09,0.1); setTimeout(()=>playTone(660,'sine',0.08,0.09,0.08),60); },
  jump:     ()=>{ playTone(350,'sine',0.06,0.07,0.06); },
  block:    ()=>{ playNoise(0.07,0.12); playTone(200,'square',0.06,0.10,0.06); },
  bossRoar: ()=>{ playTone(55,'sawtooth',0.7,0.16,0.7); playNoise(0.4,0.12); },
  comboHit: ()=>{ playTone(140+Math.random()*60,'square',0.06,0.12,0.06); playNoise(0.04,0.07); },
};


// ============================================================
// BOSS MUSIC CONTROLLER — uses boss_music.mp3 (bundled in zip)
// ============================================================
const bossMusic = {
  _vol: 0.55,
  _el: null,
  _get(){
    if(!this._el){
      this._el = document.getElementById('boss-music');
    }
    return this._el;
  },
  play(){
    const el = this._get(); if(!el) return;
    el.volume = this._vol;
    el.currentTime = 0;
    el.loop = true;
    const p = el.play();
    if(p && p.catch) p.catch(()=>{});
  },
  stop(){
    const el = this._get(); if(!el) return;
    let vol = el.volume;
    const fade = setInterval(()=>{
      vol = Math.max(0, vol - 0.06);
      try{ el.volume = vol; }catch(e){}
      if(vol <= 0){ clearInterval(fade); el.pause(); el.currentTime = 0; try{el.volume=this._vol;}catch(e){} }
    }, 60);
  },
  pause(){
    const el = this._get(); if(!el) return;
    el.pause();
  },
  resume(){
    const el = this._get(); if(!el) return;
    if(el.paused && el.currentTime > 0){
      const p = el.play();
      if(p && p.catch) p.catch(()=>{});
    }
  },
  setVolume(v){
    this._vol = v;
    const el = this._get();
    if(el) try{ el.volume = v; }catch(e){}
  }
};


// ============================================================
// GLOBAL STATE
// ============================================================
let totalSouls=0,currentBoss=null,defeatedBosses=[],rebirthCount=0,rebirthAbilities=[];
let fightStartTime=0;
let _lbFilter='all';
let _lbFromScreen='screen-title';
let upgrades={hp:0,damage:0,estus:0,defense:0,stamina:0,
  sword:1,mace:0,bow:0,wand:0,katana:0,greatsword:0,spear:0,
  scythe:0,twinblades:0,crossbow:0,halberd:0,flail:0,dagger:0,rapier:0,waraxe:0,
  swordDmg:0,maceDmg:0,bowDmg:0,wandPow:0,katanaDmg:0,gswordDmg:0,spearDmg:0,
  scytheDmg:0,twinbladesDmg:0,crossbowDmg:0,halberdDmg:0,flailDmg:0,daggerDmg:0,rapierDmg:0,waraxeDmg:0,
  soul_arrow:0,fireball:0,heal_spell:0,dark_orb:0,lightning:0,
  magic:0};
let equippedWeapon='sword';
let equippedArmor='hollow';
let equippedWeapon2='sword';
let equippedArmor2='hollow';
let gameMode='1p';
let ngPlus=0;               // New Game+ count (0 = normal)
let bossRushMode=false;     // True when playing boss rush
let bossRushIndex=0;        // Current boss in rush sequence
let bossRushSouls=0;        // Total souls earned in rush
let bossRushStartTime=0;    // When rush started
let unlockedAchievements=[];// Array of unlocked achievement IDs
let _pendingLbEntry=null;   // Temp store while waiting for name entry
let screenShake={x:0,y:0,frames:0,intensity:0};

// ── KEYBINDS ──
const DEFAULT_BINDS_P1={left:'a',right:'d',jump:'w',roll:' ',attack:'j',magic:'k',heal:'e',block:'f'};
const DEFAULT_BINDS_P2={left:'arrowleft',right:'arrowright',jump:'arrowup',roll:',',attack:'l',magic:';',heal:"'",block:'/'};
let keybinds1={...DEFAULT_BINDS_P1};
let keybinds2={...DEFAULT_BINDS_P2};
const KEYBIND_SAVE_KEY='darkpixels_keybinds';
function saveKeybinds(){try{localStorage.setItem(KEYBIND_SAVE_KEY,JSON.stringify({p1:keybinds1,p2:keybinds2}));}catch(e){}}
function loadKeybinds(){
  try{
    const d=JSON.parse(localStorage.getItem(KEYBIND_SAVE_KEY)||'null');
    if(d){keybinds1=Object.assign({...DEFAULT_BINDS_P1},d.p1||{});keybinds2=Object.assign({...DEFAULT_BINDS_P2},d.p2||{});}
  }catch(e){}
}

// ADMIN STATE
let autoPlayEnabled=false;
let godModeEnabled=false;
let cornerClicks={tl:false,tr:false,bl:false,br:false};

// ============================================================
// SAVE / LOAD SYSTEM  (localStorage + cookie dual-write)
// ============================================================
const SAVE_KEY = 'darkpixels_save';
const COOKIE_EXPIRE_DAYS = 365;

// ── Cookie helpers ──
function setCookie(name,value,days){
  try{
    const exp=new Date(Date.now()+days*864e5).toUTCString();
    // cookies have a ~4KB limit — store compressed key
    const v=encodeURIComponent(value);
    document.cookie=`${name}=${v};expires=${exp};path=/;SameSite=Lax`;
  }catch(e){}
}
function getCookie(name){
  try{
    const m=document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]*)'));
    return m?decodeURIComponent(m[1]):null;
  }catch(e){return null;}
}
function deleteCookie(name){
  document.cookie=`${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

// ── Build save object ──
function buildSaveData(){
  return {
    v:1,totalSouls,defeatedBosses,upgrades,
    equippedWeapon,equippedArmor,equippedWeapon2,equippedArmor2,
    rebirthCount,rebirthAbilities,ngPlus,unlockedAchievements,gameMode,
    saved:Date.now()
  };
}

// ── Apply loaded data to game state ──
function applySaveData(d){
  totalSouls           = d.totalSouls       ?? 0;
  defeatedBosses       = d.defeatedBosses   ?? [];
  upgrades             = Object.assign({hp:0,damage:0,estus:0,defense:0,stamina:0,
    sword:1,mace:0,bow:0,wand:0,katana:0,greatsword:0,spear:0,
    scythe:0,twinblades:0,crossbow:0,halberd:0,flail:0,dagger:0,rapier:0,waraxe:0,
    swordDmg:0,maceDmg:0,bowDmg:0,wandPow:0,katanaDmg:0,gswordDmg:0,spearDmg:0,
    scytheDmg:0,twinbladesDmg:0,crossbowDmg:0,halberdDmg:0,flailDmg:0,daggerDmg:0,rapierDmg:0,waraxeDmg:0,
    soul_arrow:0,fireball:0,heal_spell:0,dark_orb:0,lightning:0,magic:0},
    d.upgrades||{});
  equippedWeapon       = d.equippedWeapon   ?? 'sword';
  equippedArmor        = d.equippedArmor    ?? 'hollow';
  equippedWeapon2      = d.equippedWeapon2  ?? 'sword';
  equippedArmor2       = d.equippedArmor2   ?? 'hollow';
  rebirthCount         = d.rebirthCount     ?? 0;
  rebirthAbilities     = d.rebirthAbilities ?? [];
  ngPlus               = d.ngPlus           ?? 0;
  unlockedAchievements = d.unlockedAchievements ?? [];
  gameMode             = d.gameMode         ?? '1p';
}

// ── Auto-save (called throughout game) ──
function saveGame(){
  try{
    const json=JSON.stringify(buildSaveData());
    localStorage.setItem(SAVE_KEY,json);
    setCookie(SAVE_KEY,json,COOKIE_EXPIRE_DAYS);
    updateSaveIndicator();
  }catch(e){console.warn('Save failed:',e);}
}

// ── Manual save with feedback ──
function manualSave(){
  saveGame();
  showNotification('🔥 GAME SAVED — progress etched into the bonfire.');
  // Flash the save button briefly
  const btn=document.getElementById('manual-save-btn');
  if(btn){btn.textContent='✓ SAVED!';btn.style.borderColor='var(--green2)';btn.style.color='var(--green2)';setTimeout(()=>{btn.textContent='🔥 SAVE GAME';btn.style.borderColor='';btn.style.color='';},1800);}
}

// ── Load (prefers localStorage, falls back to cookie) ──
function loadGame(){
  let raw=null;
  try{ raw=localStorage.getItem(SAVE_KEY); }catch(e){}
  if(!raw){ raw=getCookie(SAVE_KEY); }
  if(!raw) return false;
  try{
    const d=JSON.parse(raw);
    if(!d||d.v!==1) return false;
    applySaveData(d);
    return true;
  }catch(e){console.warn('Load failed:',e);return false;}
}

// ── Update the save indicator text on title / select screens ──
function updateSaveIndicator(){
  const ind=document.getElementById('save-indicator');
  const del=document.getElementById('delete-save-btn');
  const ms=document.getElementById('manual-save-btn');
  if(!ind) return;
  if(defeatedBosses.length>0||totalSouls>0){
    const t=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    ind.textContent=`💾 SAVED ${t} — ${defeatedBosses.length} BOSSES · ${totalSouls.toLocaleString()} SOULS`;
    if(del) del.style.display='';
    if(ms)  ms.style.display='';
  } else {
    ind.textContent='';
    if(del) del.style.display='none';
    if(ms)  ms.style.display='none';
  }
}

// ── Delete save ──
function deleteSave(){
  if(confirm('DELETE ALL SAVE DATA?\n\nYour souls, upgrades, and progress will be lost forever.\n\nThis cannot be undone.')){
    try{localStorage.removeItem(SAVE_KEY);}catch(e){}
    deleteCookie(SAVE_KEY);
    totalSouls=0;defeatedBosses=[];rebirthCount=0;rebirthAbilities=[];
    upgrades={hp:0,damage:0,estus:0,defense:0,stamina:0,
      sword:1,mace:0,bow:0,wand:0,katana:0,greatsword:0,spear:0,
      scythe:0,twinblades:0,crossbow:0,halberd:0,flail:0,dagger:0,rapier:0,waraxe:0,
      swordDmg:0,maceDmg:0,bowDmg:0,wandPow:0,katanaDmg:0,gswordDmg:0,spearDmg:0,
      scytheDmg:0,twinbladesDmg:0,crossbowDmg:0,halberdDmg:0,flailDmg:0,daggerDmg:0,rapierDmg:0,waraxeDmg:0,
      soul_arrow:0,fireball:0,heal_spell:0,dark_orb:0,lightning:0,magic:0};
    equippedWeapon='sword';equippedArmor='hollow';
    equippedWeapon2='sword';equippedArmor2='hollow';
    ngPlus=0;unlockedAchievements=[];
    const badge=document.getElementById('ngplus-badge');
    if(badge) badge.style.display='none';
    updateSoulsDisplay();buildBossList();updateSaveIndicator();
    showNotification('🗑 Save data deleted. Ashen one reborn.');
    showScreen('screen-title');
  }
}

// ============================================================
// ADMIN PANEL FUNCTIONS
// ============================================================
function setupCornerTriggers(){
  const corners=['tl','tr','bl','br'];
  corners.forEach(corner=>{
    const el=document.getElementById(`corner-${corner}`);
    el.addEventListener('click',()=>{
      cornerClicks[corner]=!cornerClicks[corner];
      el.style.background=cornerClicks[corner]?'rgba(170,68,255,0.3)':'';
      
      // Check if all corners clicked
      if(Object.values(cornerClicks).every(v=>v)){
        openAdminPanel();
        // Reset corners
        Object.keys(cornerClicks).forEach(k=>cornerClicks[k]=false);
        corners.forEach(c=>document.getElementById(`corner-${c}`).style.background='');
      }
    });
  });
}

function openAdminPanel(){
  document.getElementById('admin-panel').classList.add('active');
  // Update checkbox states
  document.getElementById('admin-autoplay').checked=autoPlayEnabled;
  document.getElementById('admin-godmode').checked=godModeEnabled;
}

function closeAdminPanel(){
  document.getElementById('admin-panel').classList.remove('active');
}

function adminUnlockAllBosses(){
  defeatedBosses=[];
  BOSSES.forEach(b=>defeatedBosses.push(b.id));
  buildBossList();
  showNotification('✓ All bosses unlocked!');
}

function adminResetBosses(){
  defeatedBosses=[];
  buildBossList();
  showNotification('↻ All boss defeats reset!');
}

function adminAddSouls(amount){
  totalSouls+=amount;
  updateSoulsDisplay();
  showNotification(`💀 +${amount.toLocaleString()} souls added!`);
}

function adminMaxUpgrades(){
  upgrades={hp:10,damage:10,estus:10,defense:10,stamina:10,magic:10,
    sword:1,mace:1,bow:1,wand:1,katana:1,greatsword:1,spear:1,
    swordDmg:5,maceDmg:5,bowDmg:5,wandPow:5,katanaDmg:5,gswordDmg:5,spearDmg:5,
    soul_arrow:1,fireball:1,heal_spell:1,dark_orb:1,lightning:1};
  buildUpgradeList();
  showNotification('⚡ All upgrades maxed out!');
}

function adminGrantRebirth(){
  closeAdminPanel();
  if(rebirthCount>=MAX_REBIRTHS){
    showNotification('⚠ Max rebirths (5) already reached!');
    return;
  }
  // Show rebirth screen directly — bypasses the "all bosses defeated" check
  // We DON'T increment rebirthCount here; showRebirthScreen does it
  // We DO reset defeatedBosses (same as normal rebirth)
  showRebirthScreen();
}

function toggleAutoPlay(enabled){
  autoPlayEnabled=enabled;
  if(enabled){
    showNotification('🤖 AI Auto-Play enabled!');
  }
}

function toggleGodMode(enabled){
  godModeEnabled=enabled;
  if(enabled&&G.running&&P){
    P.hp=P.maxHp;
    updatePlayerHUD();
    showNotification('⚡ God Mode enabled! You are invincible.');
  }
}

// ============================================================
// BOSS DATA
// ============================================================
const BOSSES=[
  // ── TIER 1: EASY (★☆☆☆☆) ─────────────────────────────────
  {id:'asylum',    emoji:'👹', name:'ASYLUM DEMON',                sub:'FIRST OBSTACLE',      lore:'The bloated demon of the undead asylum, your first trial.',                                              hp:2200,atk:38,souls:1100, type:'asylum_demon',    diff:1},
  {id:'iudex',     emoji:'🗡', name:'IUDEX GUNDYR',                sub:'FIRST GUARDIAN',      lore:'The judge of the unkindled, standing eternal vigil at the cemetery of ash.',                             hp:2000,atk:35,souls:1000, type:'iudex',           diff:1},
  {id:'vordt',     emoji:'❄',  name:'VORDT OF THE BOREAL VALLEY',  sub:'FROST BEAST',         lore:'A knight consumed by the Pontiff\'s cold madness, now a feral beast of ice.',                           hp:2500,atk:40,souls:1200, type:'vordt',           diff:1},
  {id:'sif',       emoji:'🐺', name:'SIF, THE GREAT GREY WOLF',    sub:'NOBLE BEAST',         lore:'Guardian of Artorias\' grave, wielding the greatsword with grace and sorrow.',                          hp:2800,atk:42,souls:1300, type:'sif',             diff:1},
  // ── TIER 2: MODERATE (★★☆☆☆) ─────────────────────────────
  {id:'greatwood', emoji:'🌳', name:'CURSE-ROTTED GREATWOOD',      sub:'HOLLOW CONGREGATION', lore:'Ancient tree infected with curses and the festering undead.',                                            hp:3200,atk:45,souls:1500, type:'greatwood',       diff:2},
  {id:'stray',     emoji:'😈', name:'THE STRAY DEMON',             sub:'DEMON LORD',          lore:'Forgotten remnant of the demon war, left to rot in the undead asylum.',                                 hp:3500,atk:50,souls:1600, type:'stray_demon',     diff:2},
  {id:'capra',     emoji:'🐐', name:'CAPRA DEMON',                 sub:'DUAL BLADES',         lore:'Swift and deadly with twin machetes in the cramped arena.',                                             hp:2800,atk:48,souls:1400, type:'capra_demon',     diff:2},
  {id:'seath',     emoji:'🐲', name:'SEATH THE SCALELESS',         sub:'PALE DRAGON',         lore:'The albino dragon who betrayed his kin for immortality through crystal.',                               hp:4500,atk:55,souls:2000, type:'seath',           diff:2},
  // ── TIER 3: CHALLENGING (★★★☆☆) ──────────────────────────
  {id:'abyss_watchers',emoji:'🩸',name:'ABYSS WATCHERS',          sub:'SONS OF THE WOLF',    lore:'A legion of warriors who inherited the blood of the wolf and swore to hunt the Abyss eternally.',      hp:4800,atk:68,souls:3400, type:'abyss_watchers',  diff:3},
  {id:'oceiros',   emoji:'🦎', name:'OCEIROS, THE CONSUMED KING', sub:'MAD SCHOLAR',         lore:'The former king of Lothric, now a frenzied dragon consumed by his obsession with Seath\'s research.',  hp:5400,atk:74,souls:3900, type:'oceiros',         diff:3},
  {id:'ornstein',  emoji:'👑', name:'ORNSTEIN & SMOUGH',           sub:'EXECUTIONERS\' DUO',  lore:'The dragon slayer and the executioner. Anor Londo\'s final defense.',                                   hp:4500,atk:60,souls:2500, type:'ornstein',        diff:3},
  {id:'artorias',  emoji:'⚔',  name:'KNIGHT ARTORIAS',             sub:'THE ABYSSWALKER',     lore:'A legendary knight now corrupted by the Abyss he once fought.',                                         hp:4000,atk:65,souls:2200, type:'artorias',        diff:3},
  {id:'darklurker',     emoji:'👼', name:'DARKLURKER',            sub:'CHILD OF DARK',       lore:'An angel of the Abyss. It mirrors every move and multiplies in the dark, wielding light as a weapon.',    hp:6800,atk:80,souls:4800, type:'darklurker',      diff:3},
  {id:'bed_of_chaos',   emoji:'🌿', name:'BED OF CHAOS',           sub:'MOTHER OF DEMONS',    lore:'The witch Izalith tried to recreate the First Flame and became something ancient and terrible.',            hp:5000,atk:70,souls:4000, type:'bed_of_chaos',    diff:3},
  // ── TIER 4: HARD (★★★★☆) ─────────────────────────────────
  {id:'fourkings', emoji:'👻', name:'THE FOUR KINGS',              sub:'DARK WRAITHS',        lore:'Once noble rulers of New Londo, now servants of the primordial serpent.',                               hp:5000,atk:65,souls:2600, type:'four_kings',      diff:4},
  {id:'pontiff',   emoji:'👁', name:'PONTIFF SULYVAHN',            sub:'THE FALSE GOD',       lore:'A young sorcerer who wandered to the Boreal Valley and usurped the Pontiff\'s title with dark magic.',  hp:5600,atk:76,souls:4000, type:'pontiff',         diff:4},
  {id:'dancer',    emoji:'💃', name:'DANCER OF THE BOREAL VALLEY', sub:'SILENT EXECUTIONER',  lore:'A distant daughter of the Pontiff, exiled and transformed into a dark spirit executioner.',            hp:5800,atk:78,souls:3600, type:'dancer',          diff:4},
  {id:'gwyn',      emoji:'☀',  name:'GWYN, LORD OF CINDER',        sub:'FIRST FLAME',         lore:'The fallen god who linked the fire and burned himself to ash.',                                          hp:4200,atk:68,souls:2800, type:'gwyn',            diff:4},
  {id:'nashandra', emoji:'👸', name:'NASHANDRA',                   sub:'DARK CORRUPTION',     lore:'Queen of Drangleic, fragment of Manus, drawn to the throne of want.',                                  hp:6000,atk:75,souls:3500, type:'nashandra',       diff:4},
  {id:'aldrich',   emoji:'🦑', name:'ALDRICH, DEVOURER OF GODS',   sub:'SAINT OF THE DEEP',   lore:'Once a holy cleric, Aldrich dreamed of a coming age of the deep sea and consumed gods whole.',         hp:5200,atk:72,souls:3200, type:'aldrich',         diff:4},
  {id:'dragonslayer',emoji:'⚡',name:'DRAGONSLAYER ARMOUR',        sub:'IRON SENTINEL',       lore:'The animated armor of a legendary dragonslayer, still guarding the grand bridge of Lothric.',          hp:6200,atk:82,souls:4200, type:'dragonslayer',    diff:4},
  {id:'twin_princes',emoji:'👬',name:'TWIN PRINCES',               sub:'REMNANTS OF ROYALTY', lore:'The frail Lothric and the accursed Lorian, bound together in a final act of desperate loyalty.',       hp:7000,atk:79,souls:4800, type:'twin_princes',    diff:4},
  {id:'yhorm',     emoji:'🪨', name:'YHORM THE GIANT',             sub:'LORD OF CINDER',      lore:'Yhorm took his throne knowing no one could stop him, yet asked a friend to cut him down.',              hp:6500,atk:80,souls:3800, type:'yhorm',           diff:4},
  {id:'velstadt',       emoji:'🔔', name:'VELSTADT, THE ROYAL AEGIS',sub:'THE UNYIELDING BELL',lore:'Personal guardian of Vendrick, keeper of the Undead Crypt. His bell tower strikes fear into the undead.',    hp:8200,atk:89,souls:6200, type:'velstadt',        diff:4},
  // ── TIER 5: LEGENDARY (★★★★★) ────────────────────────────
  {id:'manus',     emoji:'🌑', name:'MANUS, FATHER OF THE ABYSS',  sub:'PRIMEVAL',            lore:'The first being to embrace the Dark. Father of all humanity.',                                          hp:5500,atk:70,souls:3000, type:'manus',           diff:5},
  {id:'fume_knight',    emoji:'🌑', name:'FUME KNIGHT',           sub:'RAIME THE BETRAYED',  lore:'A knight cast aside by his king, who made a pact with the fume of Nadalia and returned as something worse.',hp:7800,atk:86,souls:5600, type:'fume_knight',     diff:5},
  {id:'lud_zallen',     emoji:'🐯', name:'LUD & ZALLEN',           sub:'IVORY KINGS TIGERS',  lore:'Two royal tigers bred for slaughter, guardians of the Frigid Outskirts. Cold, relentless, coordinated.',    hp:7500,atk:84,souls:5500, type:'lud_zallen',      diff:5},
  {id:'champion_gundyr',emoji:'🔥',name:'CHAMPION GUNDYR',       sub:'THE UNKINDLED TIDE',  lore:'A fiercer incarnation of Iudex, uncaged from his chains. Faster, relentless, and burning with fury.',   hp:7200,atk:88,souls:5200, type:'champion_gundyr', diff:5},
  {id:'sister_friede',  emoji:'❄️', name:'SISTER FRIEDE',         sub:'BRIDE OF ASH',        lore:'A disillusioned wanderer who forsook the flame and now guards the painted world in frozen silence.',       hp:8500,atk:84,souls:5800, type:'sister_friede',   diff:5},
  {id:'halflight',      emoji:'🌗', name:'HALFLIGHT, SPEAR OF THE CHURCH',sub:'GUARDIAN OF THE RINGED CITY',lore:'A warrior chosen by the Ringed City to defend the gods. Both loyal champion and forsaken slave.', hp:9800,atk:96,souls:7800, type:'halflight',       diff:5},
  {id:'sinh',           emoji:'🦇', name:'SINH THE SLUMBERING DRAGON',sub:'THE ANCIENT WYRM', lore:'A poison dragon who slept for centuries beneath Shulva. Woken now, its venom corrodes steel itself.',       hp:9000,atk:91,souls:6500, type:'sinh',            diff:5},
  {id:'king_allant',    emoji:'👑', name:'OLD KING ALLANT',        sub:'FALLEN SOVEREIGN',    lore:'A king who bargained with demons and drained his kingdom of its souls. His touch steals levels.',            hp:8500,atk:88,souls:6000, type:'king_allant',      diff:5},
  {id:'eleum_loyce',    emoji:'🧊', name:'IVORY KING',             sub:'LAST OF HIS KIND',    lore:'The Ivory King who led his knights into the chaos storms. Heroic to the last, consumed by the Old Chaos.',   hp:9500,atk:93,souls:7200, type:'eleum_loyce',     diff:5},
  // ── TIER 6: GOD-TIER (💀) ────────────────────────────────
  {id:'soc',       emoji:'🔥', name:'SOUL OF CINDER',              sub:'AMALGAMATION',        lore:'The last of those who linked the flame, a composite soul wielding every style ever mastered.',          hp:7500,atk:85,souls:5000, type:'soul_of_cinder',  diff:6},
  {id:'nameless_king',  emoji:'⚡', name:'NAMELESS KING',         sub:'FIRST HEIR OF FIRE',  lore:'A forgotten god who sacrificed everything for the dragons he loved. Lightning bends to his will alone.',   hp:9000,atk:92,souls:6500, type:'nameless_king',   diff:6},
  {id:'demon_prince',   emoji:'👿', name:'DEMON PRINCE',           sub:'LORDS OF CHAOS',      lore:'Twin demon lords fused into a single winged abomination. Their Chaos fire devours all hope.',                 hp:11000,atk:98,souls:8000, type:'demon_prince',   diff:6},
  {id:'midir',     emoji:'🐉', name:'DARKEATER MIDIR',             sub:'ETERNAL GUARDIAN',    lore:'A dragon raised by the gods to eternally battle the dark. Its body now corrupted by the Abyss.',       hp:8000,atk:90,souls:5500, type:'midir',           diff:6},
  {id:'ancient_dragon', emoji:'🐲', name:'ANCIENT DRAGON',         sub:'ETERNAL WITNESS',     lore:'A dragon who has watched all of history from a stone tower. Its breath burns entire kingdoms to cinder.',    hp:10000,atk:95,souls:7000,type:'ancient_dragon',  diff:6},
  {id:'gael',           emoji:'🩸', name:'SLAVE KNIGHT GAEL',      sub:'FINAL DARK SOUL',     lore:'A slave knight who consumed the Dark Soul of humanity to bring it to his master\'s painted world.',      hp:12000,atk:100,souls:9000,type:'gael',            diff:6},
  {id:'friede_final',   emoji:'❄', name:'BLACKFLAME FRIEDE',       sub:'ASH RESURRECTED',     lore:'Friede\'s true form, reborn in blackflame after slaying Father Ariandel. Cold fury incarnate.',         hp:11500,atk:97,souls:8500, type:'friede_final',    diff:6},
  {id:'crossbreed_priscilla',emoji:'🌸',name:'CROSSBREED PRISCILLA',sub:'LIFEHUNT SCYTHE',   lore:'The crossbreed of the painted world, wielding a scythe that drains the essence of life itself.',         hp:9200,atk:88,souls:7500,  type:'priscilla',       diff:5},
  {id:'quelaag',        emoji:'🕷', name:'CHAOS WITCH QUELAAG',    sub:'DAUGHTER OF CHAOS',   lore:'Half-woman, half-spider. She guards the second bell of awakening with corrosive chaos flame.',          hp:7800,atk:82,souls:5800,  type:'quelaag',         diff:4},
  {id:'moonlight_butterfly',emoji:'🦋',name:'MOONLIGHT BUTTERFLY', sub:'CRYSTAL SENTINEL',   lore:'A butterfly of moonlight crystal, born of Seath\'s sorcery. Its wings scatter crystalline death.',      hp:5800,atk:68,souls:3800,  type:'moonlight_butterfly',diff:3},
];

// ============================================================
// MODE SELECT
// ============================================================
function setMode(m){
  gameMode=m;
  const badge=document.getElementById('mode-badge');
  if(badge){
    badge.className=m==='2p'?'badge-2p':'badge-1p';
    badge.textContent=m==='2p'?'2P CO-OP':'1P MODE';
  }
  showScreen('screen-select');
}

// ============================================================
// ARMOR DATA
// ============================================================
const ARMOR_DATA=[
  {
    key:'hollow', icon:'🛡', name:'HOLLOW KNIGHT', cost:0,
    desc:'Balanced unkindled build. The default garb of the ashen ones.',
    bodyC:'#4488cc', headC:'#cc9966', helmType:'open',
    stats:{def:0,atk:0,spd:0,mp:0},
    statDesc:['DEF +0','ATK +0','SPD +0','MP +0'],
    requires:null
  },
  {
    key:'black_iron', icon:'⛓', name:'BLACK IRON SET', cost:3000,
    desc:'Immense poise. +25% defense. -10% move speed. Slow rolling knight.',
    bodyC:'#2a2a3a', headC:'#222233', helmType:'full',
    stats:{def:0.25,atk:0,spd:-0.10,mp:0},
    statDesc:['DEF +25%','ATK +0','SPD -10%','MP +0'],
    requires:null
  },
  {
    key:'gold_traced', icon:'✨', name:'GOLD TRACED SET', cost:4000,
    desc:'Warrior armor. +20% attack damage. Light enough for fast rolls.',
    bodyC:'#8a6020', headC:'#cc9966', helmType:'half',
    stats:{def:0.05,atk:0.20,spd:0,mp:0},
    statDesc:['DEF +5%','ATK +20%','SPD +0','MP +0'],
    requires:null
  },
  {
    key:'dark_wanderer', icon:'🌑', name:'DARK WANDERER', cost:3500,
    desc:'Light shadow cloak. +2 roll iframes. +10% speed. Minimum defense.',
    bodyC:'#1a0a28', headC:'#221133', helmType:'hood',
    stats:{def:-0.05,atk:0,spd:0.10,mp:0},
    statDesc:['DEF -5%','ATK +0','SPD +10%','MP +0'],
    requires:null
  },
  {
    key:'sorcerer', icon:'🔮', name:'SORCERER ROBE', cost:4500,
    desc:'Arcane cloth. +40% max MP. +30% magic damage. Fragile against hits.',
    bodyC:'#0a1233', headC:'#1a2244', helmType:'hat',
    stats:{def:-0.10,atk:0,spd:0,mp:0.40},
    statDesc:['DEF -10%','ATK +0','SPD +0','MP +40%'],
    requires:null
  },
  // ── NEW ARMOR SETS ───────────────────────────────────────────────
  {
    key:'lothric_knight', icon:'⚜️', name:'LOTHRIC KNIGHT SET', cost:5000,
    desc:'Elegant knight armor. +15% attack, +15% defense. Well-rounded build.',
    bodyC:'#3a5080', headC:'#2a3a60', helmType:'full',
    stats:{def:0.15,atk:0.15,spd:0,mp:0},
    statDesc:['DEF +15%','ATK +15%','SPD +0','MP +0'],
    requires:null
  },
  {
    key:'pyromancer', icon:'🔥', name:'PYROMANCER GARB', cost:4000,
    desc:'Ashen cloth. +50% fire damage. +25% spell power. Low defense.',
    bodyC:'#331400', headC:'#442200', helmType:'hood',
    stats:{def:-0.08,atk:0.10,spd:0,mp:0.50},
    statDesc:['DEF -8%','ATK +10%','SPD +0','MP +50%'],
    requires:null
  },
  {
    key:'assassin', icon:'🐍', name:'ASSASSIN SET', cost:5500,
    desc:'Stealth garb. +3 roll iframes. +15% speed. +20% backstab damage.',
    bodyC:'#0d0d0d', headC:'#1a1a1a', helmType:'hood',
    stats:{def:-0.05,atk:0.20,spd:0.15,mp:0},
    statDesc:['DEF -5%','ATK +20%','SPD +15%','MP +0'],
    requires:null
  },
  {
    key:'herald', icon:'🕊️', name:'HERALD SET', cost:4800,
    desc:'Blessed armor. +20% HP restored from Estus. +10% DEF. Paladin build.',
    bodyC:'#b8a070', headC:'#ccaa80', helmType:'half',
    stats:{def:0.10,atk:0,spd:0,mp:0.15},
    statDesc:['DEF +10%','ATK +0','SPD +0','MP +15%'],
    requires:null
  },
  {
    key:'chaos_witch', icon:'🌋', name:'CHAOS WITCH SET', cost:6000,
    desc:'Ancient fire robes. +60% MP. +20% all damage. Extreme fragility.',
    bodyC:'#1a0800', headC:'#2a1000', helmType:'hat',
    stats:{def:-0.20,atk:0.20,spd:0,mp:0.60},
    statDesc:['DEF -20%','ATK +20%','SPD +0','MP +60%'],
    requires:null
  },
  {
    key:'iron_golem', icon:'🪨', name:'IRON GOLEM ARMOR', cost:7000,
    desc:'Indestructible forged iron. +40% DEF. -15% speed. Unstoppable tank.',
    bodyC:'#444444', headC:'#333333', helmType:'full',
    stats:{def:0.40,atk:0,spd:-0.15,mp:0},
    statDesc:['DEF +40%','ATK +0','SPD -15%','MP +0'],
    requires:null
  },
  {
    key:'wolf_knight', icon:'🐺', name:'WOLF KNIGHT SET', cost:6500,
    desc:'Artorias\' legendary garb. +25% ATK. +10% DEF. +5% speed. Balanced.',
    bodyC:'#223366', headC:'#1a2855', helmType:'full',
    stats:{def:0.10,atk:0.25,spd:0.05,mp:0},
    statDesc:['DEF +10%','ATK +25%','SPD +5%','MP +0'],
    requires:null
  },
  {
    key:'painted_world', icon:'🎨', name:'PAINTED WORLD SET', cost:5800,
    desc:'Friede\'s ethereal robes. +12% speed. +20% DEF vs magic. +15% ATK.',
    bodyC:'#222244', headC:'#333366', helmType:'hood',
    stats:{def:0.08,atk:0.15,spd:0.12,mp:0.10},
    statDesc:['DEF +8%','ATK +15%','SPD +12%','MP +10%'],
    requires:null
  },
];

// ============================================================
// FIRELINK SHRINE DATA
// ============================================================
const STAT_DATA=[
  {key:'hp',    icon:'❤️', name:'VIGOR',      desc:'+30 max HP per level.',           cost:800, max:10},
  {key:'damage',icon:'⚔️', name:'STRENGTH',   desc:'+3 attack damage per level.',     cost:1000,max:10},
  {key:'estus', icon:'⚱️', name:'ESTUS FLASK',desc:'+1 Estus charge per level.',      cost:1200,max:10},
  {key:'defense',icon:'🛡️',name:'VITALITY',   desc:'+3% damage reduction per level.', cost:900, max:10},
  {key:'stamina',icon:'⚡', name:'ENDURANCE',  desc:'+10 max stamina per level.',      cost:850, max:10},
];

const WEAPON_DATA=[
  {key:'sword',      icon:'⚔️', name:'UNLOCK SWORD',      desc:'Start with Sword (Default) — UNLOCKED',          cost:0,    max:1, isWeapon:true, default:true},
  {key:'mace',       icon:'🔨', name:'UNLOCK MACE',       desc:'Heavy weapon. Breaks blocks.',                   cost:2000, max:1, isWeapon:true},
  {key:'bow',        icon:'🏹', name:'UNLOCK BOW',        desc:'Ranged weapon. Fire arrows.',                    cost:2500, max:1, isWeapon:true},
  {key:'wand',       icon:'🪄', name:'UNLOCK WAND',       desc:'Enables magic casting.',                         cost:3000, max:1, isWeapon:true},
  {key:'katana',     icon:'🗡️', name:'UNLOCK KATANA',    desc:'3-hit rapid combo. Fast but lighter damage.',    cost:3500, max:1, isWeapon:true},
  {key:'greatsword', icon:'⚔',  name:'UNLOCK GREATSWORD',desc:'2× damage, slow swing. Staggers boss briefly.',  cost:5000, max:1, isWeapon:true},
  {key:'spear',      icon:'🔱', name:'UNLOCK SPEAR',     desc:'Extended reach (200px). Keep your distance.',    cost:4000, max:1, isWeapon:true},
  {key:'scythe',     icon:'🌙', name:'UNLOCK SCYTHE',    desc:'Wide arc sweep — hits all nearby enemies at once.',cost:4500,max:1, isWeapon:true},
  {key:'twinblades', icon:'⚡', name:'UNLOCK TWIN BLADES',desc:'Dual wield — 5-hit flurry, bleeds the boss.',    cost:5500, max:1, isWeapon:true},
  {key:'crossbow',   icon:'🎯', name:'UNLOCK CROSSBOW',  desc:'Rapid bolts — fires 3 quick shots per trigger.',  cost:4800, max:1, isWeapon:true},
  {key:'halberd',    icon:'🪓', name:'UNLOCK HALBERD',   desc:'1.8× damage + knockback. Slow but devastating.',  cost:5200, max:1, isWeapon:true},
  {key:'flail',      icon:'⛓', name:'UNLOCK FLAIL',     desc:'Chained mace — stuns boss on hit for 0.5s.',      cost:4200, max:1, isWeapon:true},
  {key:'dagger',     icon:'🔪', name:'UNLOCK DAGGER',   desc:'6-hit flurry, ultra-fast. +50% backstab crit.',   cost:3800, max:1, isWeapon:true},
  {key:'rapier',     icon:'🤺', name:'UNLOCK RAPIER',   desc:'Piercing thrust — ignores 30% armor. High crit.',  cost:4600, max:1, isWeapon:true},
  {key:'waraxe',     icon:'🪓', name:'UNLOCK WAR AXE',  desc:'1.4× dmg, shreds boss def 10% per hit (5 stacks).',cost:4900,max:1, isWeapon:true},
  {key:'swordDmg',   icon:'⚔️+',name:'SWORD DAMAGE',     desc:'+20% sword damage per level.',                   cost:1000, max:5, isWeapon:false},
  {key:'maceDmg',    icon:'🔨+',name:'MACE DAMAGE',      desc:'+20% mace damage per level.',                    cost:1000, max:5, isWeapon:false},
  {key:'bowDmg',     icon:'🏹+',name:'BOW DAMAGE',       desc:'+20% bow damage per level.',                     cost:1000, max:5, isWeapon:false},
  {key:'wandPow',    icon:'🪄+',name:'WAND POWER',       desc:'+25% spell damage per level.',                   cost:1000, max:5, isWeapon:false},
  {key:'katanaDmg',  icon:'🗡️+',name:'KATANA MASTERY',  desc:'+15% katana damage per level.',                  cost:1000, max:5, isWeapon:false},
  {key:'gswordDmg',  icon:'⚔+', name:'GREATSWORD POWER',desc:'+20% greatsword damage per level.',               cost:1200, max:5, isWeapon:false},
  {key:'spearDmg',   icon:'🔱+',name:'SPEAR MASTERY',   desc:'+15% spear damage per level.',                   cost:1000, max:5, isWeapon:false},
  {key:'scytheDmg',  icon:'🌙+',name:'SCYTHE MASTERY',  desc:'+18% scythe damage per level.',                  cost:1100, max:5, isWeapon:false},
  {key:'twinbladesDmg',icon:'⚡+',name:'TWIN BLADE MASTERY',desc:'+12% twin blade damage per level.',          cost:1000, max:5, isWeapon:false},
  {key:'crossbowDmg',icon:'🎯+',name:'CROSSBOW MASTERY',desc:'+15% crossbow damage per level.',                cost:1000, max:5, isWeapon:false},
  {key:'halberdDmg', icon:'🪓+',name:'HALBERD MASTERY', desc:'+20% halberd damage per level.',                 cost:1200, max:5, isWeapon:false},
  {key:'flailDmg',   icon:'⛓+',name:'FLAIL MASTERY',   desc:'+18% flail damage per level.',                   cost:1100, max:5, isWeapon:false},
  {key:'daggerDmg',  icon:'🔪+',name:'DAGGER MASTERY',  desc:'+12% dagger damage per level.',                  cost:900,  max:5, isWeapon:false},
  {key:'rapierDmg',  icon:'🤺+',name:'RAPIER MASTERY',  desc:'+15% rapier damage per level.',                  cost:1000, max:5, isWeapon:false},
  {key:'waraxeDmg',  icon:'🪓+',name:'WAR AXE MASTERY', desc:'+17% war axe damage per level.',                 cost:1100, max:5, isWeapon:false},
];

const MAGIC_DATA=[
  {key:'soul_arrow', icon:'💙', name:'SOUL ARROW',  desc:'Fast homing bolt. 25 MP.',  cost:1500, max:1},
  {key:'fireball',   icon:'🔥', name:'FIREBALL',    desc:'Explosive fire orb. 40 MP.',cost:2500, max:1},
  {key:'heal_spell', icon:'✨', name:'HEAL',         desc:'Restore 40 HP. 35 MP.',    cost:2000, max:1},
  {key:'dark_orb',   icon:'🟣', name:'DARK ORB',    desc:'Piercing dark bolt. 50 MP.',cost:4000, max:1},
  {key:'lightning',  icon:'⚡', name:'LIGHTNING',   desc:'Lightning bolt. 45 MP.',    cost:5000, max:1},
];

// Extended upgrades to track all keys
// upgrades = {hp, damage, estus, defense, stamina, sword, mace, bow, wand, swordDmg, maceDmg, bowDmg, wandPow, soul_arrow, fireball, heal_spell, dark_orb, lightning}

function switchShrineTab(tab, btn){
  document.querySelectorAll('.shrine-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.shrine-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('shrine-'+tab).classList.add('active');
}

function buildUpgradeList(){
  // Stats
  const statPanel=document.getElementById('shrine-stats');
  statPanel.innerHTML='';
  STAT_DATA.forEach(u=>{
    const lvl=upgrades[u.key]||0;
    const maxed=lvl>=u.max;
    const cost=u.cost*(lvl+1);
    const canAfford=totalSouls>=cost;
    const card=document.createElement('div');
    card.className='upgrade-card'+(maxed?' maxed':'');
    card.innerHTML=`
      <div class="upgrade-icon">${u.icon}</div>
      <div class="upgrade-info">
        <div class="upgrade-name">${u.name}</div>
        <div class="upgrade-desc">${u.desc}</div>
        <div class="upgrade-cost">${maxed?'MAX LEVEL':(canAfford?`⚙ ${cost.toLocaleString()} SOULS`:`⚙ ${cost.toLocaleString()} (need ${(cost-totalSouls).toLocaleString()} more)`)}</div>
        <div class="upgrade-lvl">Lv.${lvl}/${u.max}</div>
      </div>`;
    if(!maxed&&canAfford) card.onclick=()=>purchaseUpgrade(u.key,'stat');
    statPanel.appendChild(card);
  });

  // Weapons
  const weapGrid=document.getElementById('shrine-weapons-grid');
  weapGrid.innerHTML='';
  WEAPON_DATA.forEach(u=>{
    const lvl=upgrades[u.key]||0;
    const maxed=lvl>=u.max;
    const cost=u.isWeapon&&u.default?0:u.cost*(lvl+1);
    const canAfford=u.default||totalSouls>=cost;
    const owned=upgrades[u.key]>=1||u.default;
    const equipped1=u.isWeapon&&equippedWeapon===u.key;
    const equipped2=u.isWeapon&&equippedWeapon2===u.key;
    const card=document.createElement('div');
    card.className='upgrade-card'+(maxed&&!u.isWeapon?' maxed':'')+(equipped1?' equipped':'');
    // Draw mini weapon preview on card
    const weapPreview=getWeaponPreviewHTML(u.key,owned);
    card.innerHTML=`
      ${equipped1?'<div class="equip-badge">P1 EQ</div>':''}
      ${equipped2&&!equipped1?'<div class="equip-badge" style="color:var(--p2);border-color:var(--p2)">P2 EQ</div>':''}
      <div class="upgrade-icon">${u.icon}${weapPreview}</div>
      <div class="upgrade-info">
        <div class="upgrade-name weapon-name">${u.name}</div>
        <div class="upgrade-desc">${u.isWeapon&&owned?'UNLOCKED — '+u.desc.split('—')[0]:u.desc}</div>
        <div class="upgrade-cost">${maxed&&u.isWeapon&&owned?'OWNED':(canAfford&&!maxed?`⚙ ${cost.toLocaleString()} SOULS`:(maxed?'MAX LEVEL':`⚙ ${cost.toLocaleString()} (need ${(cost-totalSouls).toLocaleString()} more)`))}</div>
        <div class="upgrade-lvl">${u.isWeapon?'':'Lv.'+lvl+'/'+u.max}</div>
        ${owned&&u.isWeapon&&gameMode==='2p'?`<div style="display:flex;gap:4px;margin-top:3px;">
          <div onclick="event.stopPropagation();equippedWeapon='${u.key}';buildUpgradeList();" style="font-size:clamp(4px,.55vw,5px);padding:2px 5px;border:1px solid ${equipped1?'var(--gold)':'#333'};color:${equipped1?'var(--gold)':'#555'};cursor:pointer;background:rgba(0,0,0,.4);">P1</div>
          <div onclick="event.stopPropagation();equippedWeapon2='${u.key}';buildUpgradeList();" style="font-size:clamp(4px,.55vw,5px);padding:2px 5px;border:1px solid ${equipped2?'var(--p2)':'#333'};color:${equipped2?'var(--p2)':'#555'};cursor:pointer;background:rgba(0,0,0,.4);">P2</div>
        </div>`:''}
      </div>`;
    if(u.isWeapon&&owned&&!equipped1&&gameMode!=='2p'){
      card.style.cursor='pointer';
      card.onclick=()=>{ equippedWeapon=u.key; buildUpgradeList(); };
    } else if(!owned&&canAfford){
      card.style.cursor='pointer';
      card.onclick=()=>purchaseUpgrade(u.key,'weapon');
    } else if(!u.isWeapon&&!maxed&&canAfford){
      card.style.cursor='pointer';
      card.onclick=()=>purchaseUpgrade(u.key,'weapon');
    }
    weapGrid.appendChild(card);
  });

  // Armor
  buildArmorPanel();

  // Magic
  const magGrid=document.getElementById('shrine-magic-grid');
  magGrid.innerHTML='';
  MAGIC_DATA.forEach(u=>{
    const learned=upgrades[u.key]>=1;
    const canAfford=totalSouls>=u.cost;
    const card=document.createElement('div');
    card.className='magic-card'+(learned?' learned':'');
    card.innerHTML=`
      <div class="magic-icon">${u.icon}</div>
      <div class="magic-info">
        <div class="magic-name">${u.name}</div>
        <div class="magic-desc">${u.desc}</div>
        <div class="magic-cost">${learned?'LEARNED':(canAfford?`⚙ ${u.cost.toLocaleString()} SOULS`:`⚙ ${u.cost.toLocaleString()} (need ${(u.cost-totalSouls).toLocaleString()} more)`)}</div>
      </div>`;
    if(!learned&&canAfford){ card.onclick=()=>purchaseUpgrade(u.key,'magic'); }
    magGrid.appendChild(card);
  });

  // Tech tree
  buildTechTree();

  document.getElementById('shop-souls-display').textContent=totalSouls.toLocaleString();
}

function getWeaponPreviewHTML(key, owned){
  if(!owned) return '';
  const colors={sword:'#cccccc',mace:'#888855',bow:'#886633',wand:'#aa44ff'};
  const c=colors[key]||'#888';
  return `<span style="display:inline-block;width:3px;height:${key==='mace'?14:key==='bow'?16:18}px;background:${c};margin-left:2px;vertical-align:middle;${key==='mace'?'width:5px;':''}${key==='wand'?`box-shadow:0 0 4px ${c};`:''}" title="${key}"></span>`;
}

function buildArmorPanel(){
  const panel=document.getElementById('shrine-armor');
  panel.innerHTML='<div style="font-size:clamp(4px,.7vw,6px);color:#555;letter-spacing:2px;margin-bottom:6px;">ARMOR CHANGES CHARACTER APPEARANCE + STATS</div>';
  ARMOR_DATA.forEach(a=>{
    const owned=a.cost===0||upgrades['armor_'+a.key]>=1;
    const equipped1=equippedArmor===a.key;
    const equipped2=equippedArmor2===a.key;
    const canAfford=owned||totalSouls>=a.cost;
    const card=document.createElement('div');
    card.className='upgrade-card'+(equipped1?' equipped':'')+(owned?'':' locked-node');
    // Mini armor pixel preview
    const preview=getArmorPreviewSVG(a);
    card.innerHTML=`
      ${equipped1?'<div class="equip-badge">P1</div>':''}
      ${equipped2&&!equipped1?`<div class="equip-badge" style="color:var(--p2);border-color:var(--p2)">P2</div>`:''}
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
        <div class="upgrade-icon">${a.icon}</div>
        ${preview}
      </div>
      <div class="upgrade-info">
        <div class="upgrade-name armor-name">${a.name}</div>
        <div class="upgrade-desc">${a.desc}</div>
        <div class="stat-bars-row">${a.statDesc.map((s,i)=>{
          const pct=Math.abs(parseFloat(s.replace(/[^-\d.]/g,'')));
          const col=s.includes('-')?'#aa3322':(pct>0?'#3a8a2a':'#334');
          return `<div class="stat-mini"><div class="stat-mini-label">${['DEF','ATK','SPD','MP'][i]}</div><div class="stat-mini-bar"><div class="stat-mini-fill" style="width:${Math.min(100,pct*4)}%;background:${col};"></div></div></div>`;
        }).join('')}</div>
        <div class="upgrade-cost">${owned?'OWNED':(canAfford?`⚙ ${a.cost.toLocaleString()} SOULS`:`⚙ ${a.cost.toLocaleString()} SOULS (need ${(a.cost-totalSouls).toLocaleString()} more)`)}</div>
        ${owned?`<div style="display:flex;gap:5px;margin-top:3px;">
          <div onclick="event.stopPropagation();equippedArmor='${a.key}';buildArmorPanel();updateHUDArmor();" style="font-size:clamp(4px,.55vw,5px);padding:2px 6px;border:1px solid ${equipped1?'var(--gold)':'#333'};color:${equipped1?'var(--gold)':'#555'};cursor:pointer;background:rgba(0,0,0,.4);">EQUIP P1</div>
          ${gameMode==='2p'?`<div onclick="event.stopPropagation();equippedArmor2='${a.key}';buildArmorPanel();updateHUDArmor();" style="font-size:clamp(4px,.55vw,5px);padding:2px 6px;border:1px solid ${equipped2?'var(--p2)':'#333'};color:${equipped2?'var(--p2)':'#555'};cursor:pointer;background:rgba(0,0,0,.4);">EQUIP P2</div>`:''}
        </div>`:''}
      </div>`;
    if(!owned&&canAfford) card.onclick=()=>purchaseArmor(a.key);
    panel.appendChild(card);
  });
}

function getArmorPreviewSVG(a){
  // Tiny pixel art preview in SVG
  const bc=a.bodyC, hc=a.headC;
  let helmEl='';
  if(a.helmType==='full') helmEl=`<rect x="5" y="1" width="10" height="8" fill="${bc}"/><rect x="6" y="3" width="3" height="2" fill="#224"/><rect x="11" y="3" width="3" height="2" fill="#224"/>`;
  else if(a.helmType==='half') helmEl=`<rect x="5" y="1" width="10" height="5" fill="${bc}"/><rect x="5" y="2" width="10" height="2" fill="#c8a840" opacity=".5"/><rect x="6" y="5" width="8" height="4" fill="${hc}"/>`;
  else if(a.helmType==='hood') helmEl=`<rect x="4" y="0" width="12" height="8" fill="${bc}" opacity=".9"/><rect x="6" y="4" width="8" height="5" fill="${hc}"/>`;
  else if(a.helmType==='hat') helmEl=`<rect x="3" y="-1" width="14" height="4" fill="${bc}"/><rect x="5" y="3" width="10" height="6" fill="${bc}"/><rect x="7" y="5" width="6" height="4" fill="${hc}"/>`;
  else helmEl=`<rect x="6" y="1" width="8" height="8" fill="${hc}"/>`;
  return `<svg width="20" height="28" viewBox="0 0 20 28" style="image-rendering:pixelated;flex-shrink:0;">
    ${helmEl}
    <rect x="4" y="9" width="12" height="12" fill="${bc}"/>
    <rect x="1" y="10" width="3" height="8" fill="${bc}"/>
    <rect x="16" y="10" width="3" height="8" fill="${bc}"/>
    <rect x="5" y="21" width="4" height="6" fill="${bc}"/>
    <rect x="11" y="21" width="4" height="6" fill="${bc}"/>
  </svg>`;
}

function updateHUDArmor(){
  const a1=ARMOR_DATA.find(a=>a.key===equippedArmor)||ARMOR_DATA[0];
  const a2=ARMOR_DATA.find(a=>a.key===equippedArmor2)||ARMOR_DATA[0];
  const ic1=document.getElementById('p1-armor-icon');
  const nm1=document.getElementById('p1-armor-name');
  if(ic1) ic1.textContent=a1.icon;
  if(nm1) nm1.textContent=a1.name.split(' ')[0];
  const ic2=document.getElementById('p2-armor-icon');
  const nm2=document.getElementById('p2-armor-name');
  if(ic2) ic2.textContent=a2.icon;
  if(nm2) nm2.textContent=a2.name.split(' ')[0];
}

function purchaseArmor(key){
  const a=ARMOR_DATA.find(x=>x.key===key);
  if(!a||totalSouls<a.cost) return;
  totalSouls-=a.cost;
  upgrades['armor_'+key]=1;
  equippedArmor=key;
  updateSoulsDisplay();
  buildArmorPanel();
  saveGame();
}

function buildTechTree(){
  const wrap=document.getElementById('tech-tree-wrap');
  if(!wrap) return;
  wrap.innerHTML='';

  // Helper: create a tree section with title
  function makeSection(icon,title,color='#cc8800'){
    const s=document.createElement('div');
    s.className='tree-section';
    s.innerHTML=`<div class="tree-section-title" style="color:${color}">${icon} ${title}</div>`;
    return s;
  }

  // Helper: create a scrollable row of nodes
  function makeRow(marginLeft=0){
    const r=document.createElement('div');
    r.className='tree-row';
    r.style.marginLeft=marginLeft+'px';
    return r;
  }

  // Helper: add connector between nodes
  function addConn(row){
    const c=document.createElement('div'); c.className='tree-connector'; row.appendChild(c);
  }

  // Helper: add a node
  function addNode(row,icon,name,status,classes=''){
    const n=document.createElement('div');
    n.className='tree-node'+classes;
    n.innerHTML=`<div class="tree-node-icon">${icon}</div><div class="tree-node-name">${name}</div><div class="tree-node-status">${status}</div>`;
    row.appendChild(n);
    return n;
  }

  // ═══════════════════════════════════════════
  // 1. WEAPONS TREE (expanded — 3 sub-rows)
  // ═══════════════════════════════════════════
  const weapSec=makeSection('⚔','WEAPONS TREE','#cc8800');
  const weapRows=document.createElement('div');
  weapRows.style.cssText='display:flex;flex-direction:column;gap:8px;';

  // Row 1a: Melee weapons
  const meleeRow=makeRow();
  const meleeWeapons=['sword','mace','katana','greatsword','spear','halberd','scythe','flail'];
  meleeWeapons.forEach((key,i)=>{
    const w=WEAPON_DATA.find(x=>x.key===key);
    if(!w) return;
    if(i>0) addConn(meleeRow);
    const owned=upgrades[key]>=1||w.default;
    addNode(meleeRow,w.icon,w.name.replace('UNLOCK ',''),owned?'OWNED':`${w.cost.toLocaleString()}💀`,owned?' owned':'');
  });
  // Label
  const meleeLabel=document.createElement('div');
  meleeLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#886600;letter-spacing:2px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  meleeLabel.textContent='── MELEE ──';

  // Row 1b: Ranged / special weapons
  const rangedRow=makeRow(10);
  const rangedWeapons=['bow','wand','crossbow','twinblades','dagger','rapier','waraxe'];
  rangedWeapons.forEach((key,i)=>{
    const w=WEAPON_DATA.find(x=>x.key===key);
    if(!w) return;
    if(i>0) addConn(rangedRow);
    const owned=upgrades[key]>=1||w.default;
    addNode(rangedRow,w.icon,w.name.replace('UNLOCK ',''),owned?'OWNED':`${w.cost.toLocaleString()}💀`,owned?' owned':'');
  });
  const rangedLabel=document.createElement('div');
  rangedLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#886600;letter-spacing:2px;margin-top:6px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  rangedLabel.textContent='── RANGED / SPECIAL ──';

  // Row 1c: Mastery upgrades — split into two rows
  const masterLabel=document.createElement('div');
  masterLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#664400;letter-spacing:2px;margin-top:8px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  masterLabel.textContent='── WEAPON MASTERY ──';
  const mastRow1=makeRow(10);
  const mastRow2=makeRow(10);
  const mastKeys=['swordDmg','maceDmg','katanaDmg','gswordDmg','spearDmg','halberdDmg','scytheDmg','flailDmg'];
  const mastKeys2=['bowDmg','wandPow','crossbowDmg','twinbladesDmg','daggerDmg','rapierDmg','waraxeDmg'];
  mastKeys.forEach((key,i)=>{
    const w=WEAPON_DATA.find(x=>x.key===key); if(!w) return;
    if(i>0) addConn(mastRow1);
    const lvl=upgrades[key]||0;
    addNode(mastRow1,w.icon,w.name,`Lv.${lvl}/${w.max}`,(lvl>0?' owned':'')+(lvl>=w.max?' maxed':''));
  });
  mastKeys2.forEach((key,i)=>{
    const w=WEAPON_DATA.find(x=>x.key===key); if(!w) return;
    if(i>0) addConn(mastRow2);
    const lvl=upgrades[key]||0;
    addNode(mastRow2,w.icon,w.name,`Lv.${lvl}/${w.max}`,(lvl>0?' owned':'')+(lvl>=w.max?' maxed':''));
  });

  [meleeLabel,meleeRow,rangedLabel,rangedRow,masterLabel,mastRow1,mastRow2].forEach(el=>weapRows.appendChild(el));
  weapSec.appendChild(weapRows);
  wrap.appendChild(weapSec);

  // ═══════════════════════════════════════════
  // 2. STATS TREE (expanded — tiered levels)
  // ═══════════════════════════════════════════
  const stSec=makeSection('⚡','STATS TREE','#44aaff');
  const stRows=document.createElement('div');
  stRows.style.cssText='display:flex;flex-direction:column;gap:8px;';

  STAT_DATA.forEach(s=>{
    const lvl=upgrades[s.key]||0;
    const statRow=makeRow();
    // Each stat gets its own row showing individual level tiers as nodes
    for(let tier=1;tier<=s.max;tier++){
      if(tier>1) addConn(statRow);
      const unlocked=lvl>=tier;
      const cls=unlocked?' owned':'';
      const cost=s.cost*tier;
      addNode(statRow,tier===1?s.icon:'·',tier===1?s.name:`Lv.${tier}`,unlocked?`✓ Lv.${tier}`:`${cost.toLocaleString()}💀`,cls);
    }
    stRows.appendChild(statRow);
  });

  stSec.appendChild(stRows);
  wrap.appendChild(stSec);

  // ═══════════════════════════════════════════
  // 3. ARMOR TREE (with build-type grouping)
  // ═══════════════════════════════════════════
  const armSec=makeSection('🛡','ARMOR TREE','#aaaaff');
  const armRows=document.createElement('div');
  armRows.style.cssText='display:flex;flex-direction:column;gap:8px;';

  // Group armor into build types
  const armorGroups=[
    {label:'── TANK BUILDS ──',  keys:['hollow','black_iron','iron_golem']},
    {label:'── STRENGTH BUILDS ──',keys:['gold_traced','wolf_knight','lothric_knight']},
    {label:'── SPEED BUILDS ──',  keys:['dark_wanderer','assassin','painted_world']},
    {label:'── MAGIC BUILDS ──',  keys:['sorcerer','pyromancer','chaos_witch']},
    {label:'── HYBRID BUILDS ──', keys:['herald']},
  ];

  armorGroups.forEach(grp=>{
    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:clamp(3px,.5vw,5px);color:#667799;letter-spacing:2px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
    lbl.textContent=grp.label;
    armRows.appendChild(lbl);
    const row=makeRow(10);
    grp.keys.forEach((key,i)=>{
      const a=ARMOR_DATA.find(x=>x.key===key); if(!a) return;
      if(i>0) addConn(row);
      const owned=a.cost===0||upgrades['armor_'+a.key]>=1;
      const eq1=equippedArmor===a.key;
      const eq2=equippedArmor2===a.key;
      const status=eq1?'P1 EQ':(eq2?'P2 EQ':(owned?'OWNED':`${a.cost.toLocaleString()}💀`));
      addNode(row,a.icon,a.name,(status),(owned?' owned':'')+(eq1||eq2?' equipped-node':''));
    });
    armRows.appendChild(row);
  });

  armSec.appendChild(armRows);
  wrap.appendChild(armSec);

  // ═══════════════════════════════════════════
  // 4. MAGIC TREE (with upgrade tiers)
  // ═══════════════════════════════════════════
  const magSec=makeSection('✨','MAGIC TREE','#cc44ff');
  const magRows=document.createElement('div');
  magRows.style.cssText='display:flex;flex-direction:column;gap:8px;';

  const magLabel1=document.createElement('div');
  magLabel1.style.cssText='font-size:clamp(3px,.5vw,5px);color:#884499;letter-spacing:2px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  magLabel1.textContent='── SPELLS ──';
  const magRow=makeRow();
  MAGIC_DATA.forEach((m,i)=>{
    if(i>0) addConn(magRow);
    const learned=upgrades[m.key]>=1;
    addNode(magRow,m.icon,m.name,learned?'LEARNED':`${m.cost.toLocaleString()}💀`,learned?' owned':'');
  });

  // Magic power upgrades
  const magPowLabel=document.createElement('div');
  magPowLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#663388;letter-spacing:2px;margin-top:8px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  magPowLabel.textContent='── ARCANE MASTERY ──';
  const magPowRow=makeRow(10);
  const magPowKeys=['wandPow','magic'];
  magPowKeys.forEach((key,i)=>{
    const u=WEAPON_DATA.find(x=>x.key===key)||STAT_DATA.find(x=>x.key===key);
    if(!u) return;
    if(i>0) addConn(magPowRow);
    const lvl=upgrades[key]||0;
    const maxLvl=u.max||5;
    for(let tier=1;tier<=maxLvl;tier++){
      if(tier>1) addConn(magPowRow);
      const unlocked=lvl>=tier;
      addNode(magPowRow,tier===1?u.icon:'·',tier===1?u.name:`Lv.${tier}`,unlocked?'✓':`${(u.cost*tier).toLocaleString()}💀`,unlocked?' owned':'');
    }
  });

  [magLabel1,magRow,magPowLabel,magPowRow].forEach(el=>magRows.appendChild(el));
  magSec.appendChild(magRows);
  wrap.appendChild(magSec);

  // ═══════════════════════════════════════════
  // 5. PASSIVE ABILITIES TREE (new!)
  // ═══════════════════════════════════════════
  const PASSIVE_TREE=[
    // Combat arts
    {key:'pa_parry_window',    icon:'🛡', name:'PARRY WINDOW',    desc:'+2 parry frames',         cost:1500, max:3},
    {key:'pa_roll_iframes',    icon:'💨', name:'ROLL MASTERY',    desc:'+1 iframe per level',     cost:1200, max:4},
    {key:'pa_stamina_regen',   icon:'⚡', name:'ENDURANCE',       desc:'+20% stamina regen',      cost:1000, max:5},
    {key:'pa_estus_heal',      icon:'⚱', name:'ESTUS MASTERY',   desc:'+10% Estus heal',         cost:1400, max:5},
    // Offense
    {key:'pa_crit_chance',     icon:'💥', name:'CRIT MASTERY',    desc:'+3% crit chance',         cost:1600, max:5},
    {key:'pa_crit_mult',       icon:'🔱', name:'CRIT POWER',      desc:'+10% crit multiplier',    cost:1800, max:5},
    {key:'pa_backstab',        icon:'🔪', name:'BACKSTAB ARTS',   desc:'+25% backstab damage',    cost:2000, max:3},
    {key:'pa_poise_break',     icon:'💢', name:'POISE BREAK',     desc:'+15% stagger chance',     cost:1700, max:4},
    // Defense
    {key:'pa_guard_absorb',    icon:'🛡', name:'GUARD ABSORB',    desc:'+10% guard stamina',      cost:1300, max:5},
    {key:'pa_bleed_resist',    icon:'🩸', name:'BLEED RESIST',    desc:'-20% bleed buildup',      cost:1100, max:3},
    {key:'pa_frost_resist',    icon:'❄', name:'FROST RESIST',    desc:'-20% frost buildup',      cost:1100, max:3},
    {key:'pa_curse_resist',    icon:'💀', name:'CURSE RESIST',    desc:'-25% curse buildup',      cost:1200, max:3},
  ];
  // Store passive upgrades in `upgrades` object
  const paSec=makeSection('🌀','PASSIVE ABILITIES','#44cc88');
  const paRows=document.createElement('div');
  paRows.style.cssText='display:flex;flex-direction:column;gap:8px;';

  const combatLabel=document.createElement('div');
  combatLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#336644;letter-spacing:2px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  combatLabel.textContent='── COMBAT ARTS ──';
  const combatRow=makeRow();
  PASSIVE_TREE.filter((_,i)=>i<4).forEach((p,i)=>{
    if(i>0) addConn(combatRow);
    const lvl=upgrades[p.key]||0;
    addNode(combatRow,p.icon,p.name,`Lv.${lvl}/${p.max}`,(lvl>0?' owned':'')+(lvl>=p.max?' maxed':''));
  });

  const offLabel=document.createElement('div');
  offLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#664433;letter-spacing:2px;margin-top:6px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  offLabel.textContent='── OFFENSE ──';
  const offRow=makeRow(10);
  PASSIVE_TREE.filter((_,i)=>i>=4&&i<8).forEach((p,i)=>{
    if(i>0) addConn(offRow);
    const lvl=upgrades[p.key]||0;
    addNode(offRow,p.icon,p.name,`Lv.${lvl}/${p.max}`,(lvl>0?' owned':'')+(lvl>=p.max?' maxed':''));
  });

  const defLabel=document.createElement('div');
  defLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#334466;letter-spacing:2px;margin-top:6px;margin-bottom:2px;font-family:"Press Start 2P",monospace;';
  defLabel.textContent='── RESISTANCE ──';
  const defRow=makeRow(10);
  PASSIVE_TREE.filter((_,i)=>i>=8).forEach((p,i)=>{
    if(i>0) addConn(defRow);
    const lvl=upgrades[p.key]||0;
    addNode(defRow,p.icon,p.name,`Lv.${lvl}/${p.max}`,(lvl>0?' owned':'')+(lvl>=p.max?' maxed':''));
  });

  [combatLabel,combatRow,offLabel,offRow,defLabel,defRow].forEach(el=>paRows.appendChild(el));
  paSec.appendChild(paRows);
  wrap.appendChild(paSec);

  // ═══════════════════════════════════════════
  // 6. COVENANT / COVENANT GIFTS TREE (new!)
  // ═══════════════════════════════════════════
  const COVENANT_TREE=[
    {key:'cv_way_of_white',   icon:'☀', name:'WAY OF WHITE',   desc:'Blessed covenant. +15% HP. +10% Estus heal.',      cost:3000, max:1},
    {key:'cv_forest_hunter',  icon:'🐺', name:'FOREST HUNTER', desc:'Wolf pact. +20% speed. Mark of Artorias.',         cost:4000, max:1},
    {key:'cv_darkmoon',       icon:'🌙', name:'BLADE OF DARKMOON',desc:'Gravelord service. +30% crit. Moonlight arrows.', cost:5000, max:1},
    {key:'cv_chaos_servant',  icon:'🔥', name:'CHAOS SERVANT', desc:'Daughter of chaos. +40% fire dmg. Chaos storm.',   cost:4500, max:1},
    {key:'cv_darkwraith',     icon:'🌑', name:'DARK WRAITH',   desc:'Servant of the abyss. Drain soul on hit.',         cost:6000, max:1},
    {key:'cv_sunlight',       icon:'⚡', name:'WARRIORS OF SUNLIGHT',desc:'Jolly cooperation! +25% ATK when ≤50% HP.',  cost:3500, max:1},
    {key:'cv_mound_makers',   icon:'💀', name:'MOUND-MAKERS',  desc:'Feed on souls. Combo kills restore 20 HP.',        cost:5500, max:1},
    {key:'cv_spears_church',  icon:'🌗', name:'SPEARS OF THE CHURCH',desc:'Guardian\'s blessing. +25% DEF. Holy fire.',  cost:7000, max:1},
  ];
  const cvSec=makeSection('🏵','COVENANT GIFTS','#ffaa44');
  const cvRow=makeRow();
  COVENANT_TREE.forEach((cv,i)=>{
    if(i>0) addConn(cvRow);
    const owned=upgrades[cv.key]>=1;
    addNode(cvRow,cv.icon,cv.name,owned?'✓ JOINED':`${cv.cost.toLocaleString()}💀`,owned?' owned':'');
  });
  cvSec.appendChild(cvRow);
  wrap.appendChild(cvSec);

  // ═══════════════════════════════════════════
  // 7. BOSS SOULS TREE — unlocked by defeating bosses (new!)
  // ═══════════════════════════════════════════
  const BOSS_SOUL_TREE=[
    {id:'gwyn',    icon:'☀', name:'SOUL OF GWYN',      desc:'Lord of Cinder\'s blessing. +20% fire dmg.',  reqBoss:'gwyn'},
    {id:'manus',   icon:'🌑', name:'SOUL OF MANUS',    desc:'Primeval fragment. +15% all damage.',          reqBoss:'manus'},
    {id:'seath',   icon:'🐲', name:'SOUL OF SEATH',    desc:'Crystal power. Magic +25%.',                   reqBoss:'seath'},
    {id:'soc',     icon:'🔥', name:'SOUL OF CINDER',   desc:'Amalgamation power. +10% all stats.',          reqBoss:'soc'},
    {id:'midir',   icon:'🐉', name:'SOUL OF MIDIR',    desc:'Abyss Dragon essence. +30% dark dmg.',         reqBoss:'midir'},
    {id:'gael',    icon:'🩸', name:'DARK SOUL SHARD',  desc:'Fragment of the Dark Soul. +25% all damage.',  reqBoss:'gael'},
    {id:'nameless',icon:'⚡', name:'SOUL OF THE KING', desc:'First Heir\'s power. Lightning +40%.',         reqBoss:'nameless_king'},
    {id:'artorias',icon:'⚔', name:'SOUL OF ARTORIAS', desc:'Abysswalker\'s will. +20% DEF in Abyss.',      reqBoss:'artorias'},
  ];
  const bsSec=makeSection('💎','BOSS SOUL ARTS','#ff4444');
  const bsLabel=document.createElement('div');
  bsLabel.style.cssText='font-size:clamp(3px,.5vw,5px);color:#553333;letter-spacing:2px;margin-bottom:4px;font-family:"Press Start 2P",monospace;';
  bsLabel.textContent='Defeat the named boss to unlock each soul art';
  const bsRow=makeRow();
  BOSS_SOUL_TREE.forEach((bs,i)=>{
    if(i>0) addConn(bsRow);
    const defeated=defeatedBosses.includes(bs.reqBoss);
    const owned=upgrades['bs_'+bs.id]>=1;
    const status=owned?'ABSORBED':(defeated?'CLAIMABLE':'LOCKED');
    addNode(bsRow,bs.icon,bs.name,status,defeated?(owned?' owned':' unlocked'):'');
  });
  bsSec.appendChild(bsLabel);
  bsSec.appendChild(bsRow);
  wrap.appendChild(bsSec);

  // ═══════════════════════════════════════════
  // 8. ACHIEVEMENTS OVERVIEW (read-only)
  // ═══════════════════════════════════════════
  const achSec=makeSection('🏆','ACHIEVEMENTS','#ffdd44');
  const achInfo=document.createElement('div');
  achInfo.style.cssText='font-size:clamp(3px,.5vw,5px);color:#887700;font-family:"Press Start 2P",monospace;';
  achInfo.textContent=`${unlockedAchievements.length} achievements unlocked`;
  const achRow=makeRow();
  const achPreview=['first_blood','speed_demon','no_estus','parry_master','boss_rush','all_bosses','ng_plus','katana_user','greatsword_user','spear_user'];
  achPreview.forEach((id,i)=>{
    if(i>0) addConn(achRow);
    const ach=ACHIEVEMENTS&&ACHIEVEMENTS.find(a=>a.id===id);
    if(!ach) return;
    const unlocked=unlockedAchievements.includes(id);
    addNode(achRow,ach.icon,ach.name,unlocked?'✓ DONE':'LOCKED',unlocked?' owned':'');
  });
  achSec.appendChild(achInfo);
  achSec.appendChild(achRow);
  wrap.appendChild(achSec);
}

function purchaseUpgrade(key, category){
  if(category==='stat'){
    const u=STAT_DATA.find(up=>up.key===key);
    const lvl=upgrades[key]||0;
    if(lvl>=u.max) return;
    const cost=u.cost*(lvl+1);
    if(totalSouls<cost) return;
    totalSouls-=cost; upgrades[key]=lvl+1;
  } else if(category==='weapon'){
    const u=WEAPON_DATA.find(up=>up.key===key);
    const lvl=upgrades[key]||0;
    if(lvl>=u.max) return;
    const cost=u.cost*(lvl+1);
    if(totalSouls<cost) return;
    totalSouls-=cost; upgrades[key]=lvl+1;
    if(u.isWeapon) equippedWeapon=key;
  } else if(category==='magic'){
    const u=MAGIC_DATA.find(up=>up.key===key);
    if(upgrades[key]>=1) return;
    if(totalSouls<u.cost) return;
    totalSouls-=u.cost; upgrades[key]=1;
  }
  updateSoulsDisplay();
  buildUpgradeList();
  saveGame();
}

// ============================================================
// UI & SCREENS
// ============================================================
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  
  const showCorners=id==='screen-select';
  ['tl','tr','bl','br'].forEach(c=>{
    document.getElementById(`corner-${c}`).style.display=showCorners?'block':'none';
  });
  
  if(id==='screen-select'){
    buildBossList();
    document.getElementById('select-souls').textContent=totalSouls.toLocaleString();
    const badge=document.getElementById('mode-badge');
    if(badge){
      badge.className=gameMode==='2p'?'badge-2p':'badge-1p';
      badge.textContent=gameMode==='2p'?'2P CO-OP':'1P MODE';
    }
    saveGame(); // auto-save on return to hub
  }
  else if(id==='screen-shop'){
    buildUpgradeList();
  }
}

function buildBossList(){
  const list=document.getElementById('boss-list');
  list.innerHTML='';

  const tierLabels={
    1:'TIER I — EASY',
    2:'TIER II — MODERATE',
    3:'TIER III — CHALLENGING',
    4:'TIER IV — HARD',
    5:'TIER V — LEGENDARY',
    6:'TIER VI — GOD-TIER',
  };
  const tierColors={1:'#888888',2:'#66aa44',3:'#ddaa00',4:'#ee6622',5:'#cc2244',6:'#aa00ff'};
  const starFilled='★'; const starEmpty='☆';

  function diffStars(d){
    if(d===6) return '<span style="color:#aa00ff;letter-spacing:1px">💀 GOD-TIER</span>';
    let s='';
    for(let i=1;i<=5;i++) s+=`<span style="color:${i<=d?tierColors[d]:'#333'}">${i<=d?starFilled:starEmpty}</span>`;
    return s;
  }

  let lastTier=0;
  BOSSES.forEach(b=>{
    const d=b.diff||1;
    if(d!==lastTier){
      lastTier=d;
      const hdr=document.createElement('div');
      hdr.style.cssText=`width:100%;padding:6px 4px 2px;font-size:clamp(4px,.6vw,6px);letter-spacing:2px;color:${tierColors[d]};border-bottom:1px solid ${tierColors[d]}44;margin-top:${d>1?'12px':'0'};font-family:'Press Start 2P',monospace;`;
      hdr.textContent=tierLabels[d]||'';
      list.appendChild(hdr);
    }
    const defeated=defeatedBosses.includes(b.id);
    const card=document.createElement('div');
    card.className='boss-card'+(defeated?' defeated':'');
    card.innerHTML=`
      <div class="boss-emoji">${b.emoji}</div>
      <div class="boss-info">
        <div class="boss-name-card">${b.name}</div>
        <div class="boss-meta">${b.sub} • ${b.souls.toLocaleString()} SOULS • HP: ${b.hp.toLocaleString()}</div>
        <div class="boss-diff" style="font-size:clamp(5px,.65vw,7px);margin-top:3px;letter-spacing:1px;">${diffStars(d)}</div>
      </div>
    `;
    card.onclick=()=>selectBoss(b);
    card.addEventListener('mouseenter',()=>showBossPreview(b,card));
    card.addEventListener('mouseleave',hideBossPreview);
    list.appendChild(card);
  });
}

function selectBoss(boss){
  currentBoss=boss;
  showScreen('screen-intro');
  document.getElementById('boss-name-display').textContent=boss.name;
  document.getElementById('boss-subtitle').textContent=boss.sub;
  document.getElementById('boss-lore').textContent=boss.lore;
}

function updateSoulsDisplay(){
  document.getElementById('select-souls').textContent=totalSouls.toLocaleString();
  document.getElementById('shop-souls-display').textContent=totalSouls.toLocaleString();
  document.getElementById('game-souls').textContent=totalSouls.toLocaleString();
}

// ============================================================
// GAME LOGIC
// ============================================================
const AW=()=>document.getElementById('arena').offsetWidth;
const AH=()=>document.getElementById('arena').offsetHeight;
const px=(ctx,x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};

let G={running:false,frame:0};
let P=null,B=null,particles=[],projectiles=[],obstacles=[];

function startBossFight(){
  if(!currentBoss) return;
  showScreen('screen-game');

  // Show/hide P2 elements
  const p2hud=document.getElementById('p2-hud');
  const p2ctrl=document.getElementById('p2-controls');
  if(p2hud) p2hud.style.display=gameMode==='2p'?'':'none';
  if(p2ctrl) p2ctrl.style.display=gameMode==='2p'?'flex':'none';
  
  // Boss HP bar setup
  document.getElementById('boss-name-hud').textContent=currentBoss.name;
  const track=document.getElementById('boss-hp-track');
  const fill=document.getElementById('boss-hp-fill');
  track.classList.add('show-marker');
  fill.style.background=`linear-gradient(90deg,#8b1a1a 0%,#cc2222 50%,#ff4444 100%)`;
  
  const ticksCont=document.getElementById('boss-hp-ticks');
  ticksCont.innerHTML='';
  for(let i=0;i<10;i++){
    const tick=document.createElement('div');
    tick.className='hp-tick';
    ticksCont.appendChild(tick);
  }
  
  // Get armor bonuses
  const arm1=ARMOR_DATA.find(a=>a.key===equippedArmor)||ARMOR_DATA[0];
  const arm2=ARMOR_DATA.find(a=>a.key===equippedArmor2)||ARMOR_DATA[0];

  // Init P1
  const baseHp=200+upgrades.hp*30;
  const baseStamina=80+upgrades.stamina*10;
  const floorHeight=68;
  P={
    x:80,y:AH()-floorHeight-68,w:48,h:68,
    hp:Math.floor(baseHp*(1+arm1.stats.mp*0)),maxHp:Math.floor(baseHp),
    stamina:baseStamina,maxStamina:baseStamina,
    mp:80+Math.floor(80*arm1.stats.mp),maxMp:80+Math.floor(80*arm1.stats.mp),
    guard:100,maxGuard:100,guardCooldown:0,blocking:false,
    estus:3+upgrades.estus,maxEstus:3+upgrades.estus,
    atk:Math.floor((8+upgrades.damage*3)*(1+arm1.stats.atk)),
    defense:upgrades.defense*3,
    iframes:0,rolling:false,attacking:false,casting:false,
    vx:0,vy:0,phantomBarrier:false,onGround:true,
    armor:arm1, weapon:equippedWeapon,
    speedMult:1+arm1.stats.spd, defMult:1-arm1.stats.def,
    dead:false
  };
  applyRebirthToPlayer(P);

  // Init P2
  if(gameMode==='2p'){
    P2={
      x:130,y:AH()-floorHeight-68,w:48,h:68,
      hp:Math.floor(baseHp*(1+arm2.stats.mp*0)),maxHp:Math.floor(baseHp),
      stamina:baseStamina,maxStamina:baseStamina,
      mp:80+Math.floor(80*arm2.stats.mp),maxMp:80+Math.floor(80*arm2.stats.mp),
      guard:100,maxGuard:100,guardCooldown:0,blocking:false,
      estus:3+upgrades.estus,maxEstus:3+upgrades.estus,
      atk:Math.floor((8+upgrades.damage*3)*(1+arm2.stats.atk)),
      defense:upgrades.defense*3,
      iframes:0,rolling:false,attacking:false,casting:false,
      vx:0,vy:0,phantomBarrier:false,onGround:true,
      armor:arm2, weapon:equippedWeapon2,
      speedMult:1+arm2.stats.spd, defMult:1-arm2.stats.def,
      dead:false
    };
    applyRebirthToPlayer(P2);
    const p2dead=document.getElementById('p2-dead-banner');
    if(p2dead) p2dead.style.display='none';
  } else {
    P2=null;
  }

  // Update HUD weapon/armor labels
  updateWeaponHUD(P,'p1');
  if(P2) updateWeaponHUD(P2,'p2');

  // Arena obstacles — varied layouts per boss type
  obstacles=[];
  const aw=AW(), ah=AH();
  const fl=floorHeight;
  const ground=ah-fl; // y of floor surface

  // Helper to add obstacles
  const addOb=(fracX,w,h,hp,type='pillar')=>{
    obstacles.push({x:Math.floor(aw*fracX-w/2),y:ground-h,w,h,hp,maxHp:hp,broken:false,type});
  };

  const bt=currentBoss?currentBoss.type:'iudex';
  // Layouts: mix of 'pillar' (tall), 'wall' (low wide), 'rubble' (short wide), 'platform' (medium, jumpable)
  const layouts={
    // Classic 3-pillar but staggered heights
    default:        ()=>{ addOb(0.25,26,80,3,'pillar'); addOb(0.50,22,52,2,'wall'); addOb(0.75,26,80,3,'pillar'); },
    // Wide low ruins — open battlefield
    open:           ()=>{ addOb(0.20,44,30,2,'rubble'); addOb(0.55,38,30,2,'rubble'); addOb(0.80,30,62,3,'pillar'); },
    // Tight corridor with tall pillars and a platform
    tight:          ()=>{ addOb(0.22,24,90,4,'pillar'); addOb(0.45,60,36,3,'platform'); addOb(0.78,24,90,4,'pillar'); },
    // Asymmetric — platform on left, rubble right
    asymmetric:     ()=>{ addOb(0.18,52,40,2,'platform'); addOb(0.50,20,72,3,'pillar'); addOb(0.72,48,28,2,'rubble'); },
    // Two tall pillars flanking a short wall
    flanked:        ()=>{ addOb(0.20,20,96,4,'pillar'); addOb(0.50,54,32,2,'wall'); addOb(0.80,20,96,4,'pillar'); },
    // Three ruins, all different heights
    ruins:          ()=>{ addOb(0.24,32,60,3,'pillar'); addOb(0.48,48,28,2,'rubble'); addOb(0.74,28,80,3,'pillar'); },
    // Dragon/large boss — more space, one big central ruin
    dragon:         ()=>{ addOb(0.22,52,38,3,'rubble'); addOb(0.78,52,38,3,'rubble'); },
    // Magic arena — two platforms flanking center gap
    magic:          ()=>{ addOb(0.22,60,44,3,'platform'); addOb(0.78,60,44,3,'platform'); },
  };

  const layoutMap={
    iudex:'default',        vordt:'tight',          greatwood:'ruins',
    sif:'open',             stray_demon:'flanked',  ornstein:'flanked',
    artorias:'default',     manus:'magic',          gwyn:'tight',
    asylum_demon:'ruins',   capra_demon:'tight',    seath:'dragon',
    four_kings:'magic',     nashandra:'asymmetric', aldrich:'magic',
    yhorm:'flanked',        dancer:'asymmetric',    soul_of_cinder:'tight',
    midir:'dragon',         pontiff:'default',      dragonslayer:'flanked',
    twin_princes:'asymmetric',oceiros:'dragon',     abyss_watchers:'ruins',
    champion_gundyr:'tight',sister_friede:'magic',  nameless_king:'ruins',
    fume_knight:'flanked',  darklurker:'magic',
  };

  (layouts[layoutMap[bt]]||layouts.default)();
  
  // Init boss — scale HP for 2P and NG+
  const hpMult=(gameMode==='2p'?1.5:1)*(1+ngPlus*0.5);
  const atkMult=1+ngPlus*0.3;
  const bossHp=currentBoss.hp*(1+rebirthCount*0.3)*hpMult;
  B={
    id:currentBoss.id,name:currentBoss.name,
    x:AW()-200,y:AH()-floorHeight-90,
    w:80,h:90,hp:bossHp,maxHp:bossHp,
    atk:currentBoss.atk*(1+rebirthCount*0.2)*atkMult,
    phase:1,state:'idle',stateTimer:0,attackCooldown:0,
    inCombo:false,comboTimer:0,comboHitsLeft:0,comboTotal:0,
    vy:0,onGround:true,dying:false,dyingTimer:0,armorShred:0
  };
  updateRushHUD();
  
  const canvas=document.getElementById('game-canvas');
  canvas.width=AW(); canvas.height=AH();
  G={running:true,frame:0,lastTime:0,ctx:canvas.getContext('2d')};
  particles=[]; projectiles=[];
  
  updatePlayerHUD();
  updateBossHP();
  setupControls();
  startTutorial();
  fightStartTime = Date.now();
  bossMusic.play();
  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp){
  if(!G.running) return;
  if(!G.lastTime) G.lastTime=timestamp;
  const elapsed=timestamp-G.lastTime;
  if(elapsed<15.5){ requestAnimationFrame(gameLoop); return; }
  G.dt=Math.min(elapsed,50)/16.667;
  G.lastTime=timestamp;
  G.frame++;
  if(autoPlayEnabled){ doAutoPlay(); }
  
  updatePlayer(P);
  if(P2&&!P2.dead) updatePlayer(P2);
  updateBoss();
  updateParticles();
  updateProjectiles();
  tickTutorial();
  
  const ctx=G.ctx;
  ctx.clearRect(0,0,AW(),AH());

  // Screen shake
  let sx=0,sy=0;
  if(screenShake.frames>0){
    screenShake.frames--;
    sx=(Math.random()-0.5)*screenShake.intensity;
    sy=(Math.random()-0.5)*screenShake.intensity;
    ctx.save(); ctx.translate(sx,sy);
  }

  drawArena(ctx);
  drawObstacles(ctx);
  drawPlayer(ctx,P,false);
  if(P2) drawPlayer(ctx,P2,true);

  // Boss death animation
  if(B&&B.dying){
    B.dyingTimer=(B.dyingTimer||0)+1;
    const t=B.dyingTimer;
    // Flash white with increasing frequency
    if(t%Math.max(1,Math.floor(8-t/14))<3){
      ctx.globalAlpha=0.85; ctx.fillStyle='#ffffff';
      ctx.fillRect(B.x-10,B.y-10,B.w+20,B.h+20); ctx.globalAlpha=1;
    }
    // Draw boss with fading
    ctx.globalAlpha=Math.max(0,1-t/80);
    drawBoss(ctx);
    ctx.globalAlpha=1;
    // Spawn explosion particles
    if(t%4===0){
      for(let i=0;i<4;i++) spawnHitSparks(
        B.x+Math.random()*B.w, B.y+Math.random()*B.h,
        ['#ffaa00','#ff4400','#ffffff','#ffff00'][Math.floor(Math.random()*4)],8);
    }
    // Boss floats up
    B.y-=0.5;
    if(t>=90&&!B.deathHandled){ B.deathHandled=true; endBossDeath(); }
  } else {
    drawBoss(ctx);
  }

  particles.forEach(p=>drawParticle(ctx,p));
  projectiles.forEach(proj=>drawProjectile(ctx,proj));

  if(B&&B.inCombo){
    const hitsDone=B.comboTotal-B.comboHitsLeft;
    ctx.save();
    ctx.globalAlpha=0.92;
    ctx.fillStyle='#ff4400';
    ctx.font=`bold ${Math.floor(AW()*0.018)+8}px 'Press Start 2P', monospace`;
    ctx.textAlign='center';
    const comboY=B.y-18;
    ctx.fillText('COMBO!',B.x+B.w/2,comboY);
    for(let i=0;i<B.comboTotal;i++){
      ctx.fillStyle=i<hitsDone?'#ff6600':'#331100';
      ctx.fillRect(B.x+B.w/2-B.comboTotal*8+i*16,comboY+6,12,6);
    }
    ctx.fillStyle='#ffcc00';
    ctx.font=`${Math.floor(AW()*0.012)+6}px 'Press Start 2P', monospace`;
    ctx.fillText('DODGE WITH SPACE/,',B.x+B.w/2,comboY+20);
    ctx.restore();
  }

  // Draw parry window indicator
  if(P&&P.parryWindow>0){
    ctx.globalAlpha=0.55+Math.sin(G.frame*0.5)*0.25;
    ctx.fillStyle='#ffff44';
    circ(ctx,P.x+P.w/2,P.y+P.h*0.3,14,'#ffff44');
    ctx.globalAlpha=0.3;
    circ(ctx,P.x+P.w/2,P.y+P.h*0.3,20,'#ffff00');
    ctx.globalAlpha=1;
    ctx.fillStyle='#ffcc00';
    ctx.font=`${Math.floor(AW()*0.01)+4}px 'Press Start 2P'`;
    ctx.textAlign='center';
    ctx.fillText('PARRY!',P.x+P.w/2,P.y-4);
  }

  // Restore shake translation
  if(sx||sy) ctx.restore();

  checkCollisions();
  updatePlayerHUD();
  updateBossHP();
  requestAnimationFrame(gameLoop);
}

function startGameLoop(){
  requestAnimationFrame(gameLoop);
}

function updatePlayer(pl){
  const dt=G.dt||1;
  if(!pl||pl.dead) return;
  if(pl.iframes>0) pl.iframes-=dt;
  if(pl.rolling&&pl.iframes<=0) pl.rolling=false;
  if(pl.attacking) {
    pl.attackTimer=(pl.attackTimer||0)+dt;
    const weapon=pl.weapon||equippedWeapon;
    const attackDur=weapon==='halberd'?28:weapon==='greatsword'?24:weapon==='waraxe'?26:18;
    if(pl.attackTimer>attackDur){ pl.attacking=false; pl.attackTimer=0; pl.attackHit=false; pl.maceObHit=false; pl.kataComboActive=false; pl.twinComboActive=false; pl.xbowActive=false; pl.daggerComboActive=false; }
  }
  if(pl.casting)   { pl.castTimer=(pl.castTimer||0)+dt;   if(pl.castTimer>15){   pl.casting=false;   pl.castTimer=0;   } }
  tickParry(pl);

  const spd=pl.speedMult||1;
  pl.vy+=0.6*dt;
  pl.x+=pl.vx*dt*spd;
  pl.y+=pl.vy*dt;
  pl.vx*=Math.pow(0.82,dt);

  const floorHeight=68;
  const groundY=AH()-floorHeight-pl.h;
  pl.x=Math.max(10,Math.min(AW()-pl.w-10,pl.x));
  if(pl.y<0){ pl.y=0; pl.vy=0; }
  if(pl.y>=groundY){ pl.y=groundY; pl.vy=0; pl.onGround=true; } else { pl.onGround=false; }

  obstacles.forEach(ob=>{
    if(ob.broken) return;
    const solidTop=ob.y;
    const solidH=ob.type==='platform'?Math.ceil(ob.h*0.35):ob.h;
    // Horizontal overlap check (with small margin)
    if(pl.x+pl.w>ob.x+4&&pl.x<ob.x+ob.w-4){
      const prevBottom=pl.y+pl.h-pl.vy*dt;
      // Land on top: player bottom was above or near the top last frame (increased margin for fast descent)
      if(pl.y+pl.h>=solidTop&&prevBottom<=solidTop+38&&pl.vy>=0){
        pl.y=solidTop-pl.h; pl.vy=0; pl.onGround=true; pl.coyoteFrames=8;
      }
      // Side push — only if player is clearly inside the solid body (not landing from above)
      else if(ob.type!=='platform'&&pl.y+pl.h>solidTop+22&&pl.y<solidTop+solidH){
        const overlapL=pl.x+pl.w-ob.x, overlapR=ob.x+ob.w-pl.x;
        if(overlapL<overlapR){ pl.x=ob.x-pl.w; } else { pl.x=ob.x+ob.w; }
        pl.vx=0;
      }
    }
  });

  // Coyote time — track frames since last on ground
  if(pl.onGround){ pl.coyoteFrames=8; } else if(pl.coyoteFrames>0) pl.coyoteFrames-=dt;

  if(pl.stamina<pl.maxStamina) pl.stamina=Math.min(pl.maxStamina,pl.stamina+0.2*dt);
  const mpRegenRate=pl.abyssalCore?0.12:0.06;
  if(pl.mp<pl.maxMp) pl.mp=Math.min(pl.maxMp,pl.mp+mpRegenRate*dt);
  if(pl.zeroStamTimer>0) pl.zeroStamTimer-=dt;
  if(pl.guardCooldown>0) pl.guardCooldown-=dt;
  if(!pl.blocking&&pl.guardCooldown<=0&&pl.guard<pl.maxGuard) pl.guard=Math.min(pl.maxGuard,pl.guard+0.35*dt);
  if(pl.blocking){
    pl.guard=Math.max(0,pl.guard-0.25*dt);
    if(pl.guard<=0){ pl.blocking=false; pl.guardCooldown=42; }
  }
}

function updateBoss(){
  if(B.dying) return; // skip all AI during death animation
  const dt=G.dt||1;
  B.stateTimer-=dt;
  if(B.attackCooldown>0) B.attackCooldown-=dt;
  if(B.comboTimer>0){
    B.comboTimer-=dt;
    if(B.comboTimer<=0&&B.comboHitsLeft>0) doBossComboHit();
  }

  if(B.phase===1&&B.hp<=B.maxHp*0.5){
    B.phase=2; B.atk*=1.5; flash('phase');
    SFX.phase2();
    triggerScreenShake(12, 22);
    // Phase 2 dramatic fanfare
    const bigMsg = document.getElementById('big-message');
    const subMsg = document.getElementById('sub-message');
    if(bigMsg){
      bigMsg.style.color='#ff4400';
      bigMsg.textContent='PHASE II';
      bigMsg.style.opacity='1';
      if(subMsg){ subMsg.textContent=B.name+' — ENRAGE'; subMsg.style.opacity='1'; }
      setTimeout(()=>{
        bigMsg.style.opacity='0';
        if(subMsg) subMsg.style.opacity='0';
      }, 2200);
    }
    setTimeout(()=>showNotification(`⚠ PHASE 2 — ${B.name} grows MUCH stronger!`,3200),100);
  }

  // Target nearest alive player
  let target=P;
  if(P2&&!P2.dead){
    const d1=Math.abs(B.x-P.x);
    const d2=Math.abs(B.x-P2.x);
    target=(P.dead||(d2<d1))?P2:P;
  }
  if(P.dead&&P2&&!P2.dead) target=P2;
  const dx=target.x-B.x;
  const dist=Math.abs(dx);

  B.vy+=0.7*dt;
  B.y+=B.vy*dt;
  const chaseSpeed=2.5+B.phase*0.6;
  if(!B.inCombo&&dist>110){ B.x+=Math.sign(dx)*chaseSpeed*dt; B.state='walk'; }

  const floorHeight=68;
  const groundY=AH()-floorHeight-B.h;
  if(B.y>=groundY){ B.y=groundY; B.vy=0; B.onGround=true; } else { B.onGround=false; }

  obstacles.forEach(ob=>{
    if(ob.broken) return;
    const solidH=ob.type==='platform'?Math.ceil(ob.h*0.35):ob.h;
    if(B.x+B.w>ob.x+2&&B.x<ob.x+ob.w-2&&B.y+B.h>ob.y&&B.y+B.h<ob.y+solidH+B.h){
      const prevBottom=B.y+B.h-B.vy;
      if(prevBottom<=ob.y+8&&B.vy>=0){ B.y=ob.y-B.h; B.vy=0; B.onGround=true; }
      else if(ob.type!=='platform'){
        if(B.onGround||B.vy>=0){
          const movingToward=Math.sign(dx)===Math.sign(ob.x+ob.w/2-B.x-B.w/2);
          if(movingToward){ B.vy=-13; B.onGround=false; }
          else { const oL=B.x+B.w-ob.x,oR=ob.x+ob.w-B.x; if(oL<oR) B.x=ob.x-B.w; else B.x=ob.x+ob.w; }
        }
      }
    }
  });

  B.x=Math.max(10,Math.min(AW()-B.w-10,B.x));

  if(B.stateTimer<=0&&!B.inCombo&&!B.dying){
    if(dist<=130&&B.attackCooldown<=0&&B.onGround&&Math.random()<0.7){
      // Pick attack type based on boss personality and phase
      const roll=Math.random();
      const bossType=currentBoss?currentBoss.type:'iudex';
      // Ranged-preference bosses
      const rangedBosses=['seath','four_kings','nashandra','aldrich','darklurker','sister_friede','nameless_king','pontiff','manus','ancient_dragon','sinh','eleum_loyce','king_allant','halflight','moonlight_butterfly','priscilla'];
      // Leaping bosses
      const leapBosses=['sif','capra_demon','abyss_watchers','champion_gundyr','artorias','dancer','lud_zallen','demon_prince','gael'];
      // Slam bosses
      const slamBosses=['yhorm','stray_demon','asylum_demon','greatwood','dragonslayer','midir','bed_of_chaos','velstadt','quelaag'];

      const isRanged=rangedBosses.includes(bossType);
      const isLeaper=leapBosses.includes(bossType);
      const isSlammer=slamBosses.includes(bossType);

      if(isRanged&&B.phase===2&&roll<0.35&&dist>80){
        doBossRangedAttack('spread');
      } else if(isRanged&&roll<0.25&&dist>100){
        doBossRangedAttack('single');
      } else if(isLeaper&&roll<0.30&&B.onGround){
        doBossLeap();
      } else if(isSlammer&&roll<0.25&&B.onGround&&dist<200){
        doBossSweep();
      } else if(B.phase===2&&roll<0.15&&dist>120){
        doBossRangedAttack('arc');
      } else {
        const comboLen=B.phase===2?(Math.random()<0.5?4:3):(Math.random()<0.4?3:2);
        startBossCombo(comboLen);
      }
    } else if(dist>110){ B.state='walk'; B.stateTimer=20; }
    else { B.state='idle'; B.stateTimer=20; }
  }
}

function doBossRangedAttack(type){
  if(!B||!G.running) return;
  B.state='attack'; B.stateTimer=30; B.attackCooldown=Math.max(40,70-B.phase*15);
  flash('attack');
  const tgt=P2&&!P2.dead&&Math.random()<0.5?P2:P;
  if(!tgt||tgt.dead) return;
  if(type==='single'){
    const angle=Math.atan2(tgt.y-B.y,tgt.x-B.x);
    projectiles.push({x:B.x+B.w/2,y:B.y+B.h/2,vx:Math.cos(angle)*8,vy:Math.sin(angle)*8,dmg:B.atk*0.85,from:'boss',size:14,color:'#ff4444'});
  } else if(type==='spread'){
    for(let i=-1;i<=1;i++){
      const angle=Math.atan2(tgt.y-B.y,tgt.x-B.x)+i*0.3;
      projectiles.push({x:B.x+B.w/2,y:B.y+B.h/2,vx:Math.cos(angle)*7,vy:Math.sin(angle)*7,dmg:B.atk*0.65,from:'boss',size:11,color:'#ff6622'});
    }
  } else if(type==='arc'){
    const dx=tgt.x-B.x, dist=Math.abs(dx);
    const angle=Math.atan2(-AH()*0.35,dist*Math.sign(dx));
    projectiles.push({x:B.x+B.w/2,y:B.y+B.h/2,vx:Math.cos(angle)*9,vy:Math.sin(angle)*9-2,dmg:B.atk*1.1,from:'boss',size:16,color:'#cc44ff',gravity:true});
  }
}

function doBossLeap(){
  if(!B||!G.running) return;
  B.state='attack'; B.stateTimer=40; B.attackCooldown=70;
  flash('attack');
  const tgt=P2&&!P2.dead&&Math.random()<0.5?P2:P;
  if(!tgt) return;
  B.vy=-16; B.onGround=false;
  B.vx=(tgt.x-B.x)/20;
  // Damage on landing — handled by proximity check below
  B.leaping=true;
  B.leapDmg=B.atk*1.2;
}

function doBossSweep(){
  if(!B||!G.running) return;
  B.state='attack'; B.stateTimer=35; B.attackCooldown=80;
  flash('attack');
  triggerScreenShake(7,10);
  // Wide sweep damages both players
  [P,P2].filter(pl=>pl&&!pl.dead).forEach(pl=>{
    if(Math.abs(pl.x-B.x)<200&&pl.iframes<=0) damagePlayer(B.atk*0.9,pl);
  });
  spawnHitSparks(B.x+B.w/2,B.y+B.h,'#ffaa44',14);
  // Shockwave particles along floor
  for(let i=0;i<12;i++){
    const dir=(i%2?1:-1);
    particles.push({x:B.x+B.w/2,y:AH()-80,vx:dir*(3+i*1.2),vy:-1-i*0.4,size:5,color:'#ffcc44',alpha:0.9,life:20});
  }
}

// ---- BOSS COMBO SYSTEM ----
function startBossCombo(length){
  B.inCombo=true;
  B.comboHitsLeft=length;
  B.comboTotal=length;
  B.state='attack';
  B.stateTimer=length*20+10;
  B.attackCooldown=Math.max(50,90-B.phase*20);
  // Show warning flash
  flash('attack');
  doBossComboHit();
}

function doBossComboHit(){
  if(!B.inCombo||!G.running) return;
  B.comboHitsLeft--;
  B.state='attack';
  flash('attack');
  SFX.comboHit();

  // Hit closest alive player
  const targets=([P, P2].filter(pl=>pl&&!pl.dead));
  targets.forEach(pl=>{
    const dx2=pl.x-B.x;
    const dist2=Math.abs(dx2);
    if(dist2<160&&pl.iframes<=0) damagePlayer(B.atk*0.75, pl);
  });

  if(B.phase===2&&B.comboHitsLeft===0){
    const tgt=P2&&!P2.dead&&Math.random()<0.5?P2:P;
    const angle=Math.atan2(tgt.y-B.y,tgt.x-B.x);
    projectiles.push({x:B.x+B.w/2,y:B.y+B.h/2,vx:Math.cos(angle)*7,vy:Math.sin(angle)*7,dmg:B.atk*0.9,from:'boss',size:14});
  }

  if(B.comboHitsLeft>0){ B.comboTimer=B.phase===2?16:22; }
  else { B.inCombo=false; B.state='idle'; B.stateTimer=30; }
}

function doBossAttack(){
  flash('attack');
  SFX.comboHit();
  const tgts=[P,P2].filter(pl=>pl&&!pl.dead);
  tgts.forEach(pl=>{
    const dx=pl.x-B.x;
    const dist=Math.abs(dx);
    if(dist<150&&pl.iframes<=0) damagePlayer(B.atk,pl);
  });
  if(B.phase===2&&Math.random()<0.5){
    const tgt=P2&&!P2.dead&&Math.random()<0.5?P2:P;
    const angle=Math.atan2(tgt.y-B.y,tgt.x-B.x);
    projectiles.push({x:B.x+B.w/2,y:B.y+B.h/2,vx:Math.cos(angle)*7,vy:Math.sin(angle)*7,dmg:B.atk*0.8,from:'boss',size:12});
  }
}

function damagePlayer(dmg, pl){
  if(!pl) pl=P;
  if(godModeEnabled) return;

  // Hyperarmor: player in attack windup absorbs hit without interrupt (takes reduced dmg)
  if(pl.attacking && (pl.attackTimer||0) > 3 && (pl.attackTimer||0) < 12){
    dmg *= 0.55; // reduced but not blocked
  }
  
  if(pl.phantomBarrier){
    pl.phantomBarrier=false;
    spawnParticles(pl.x+pl.w/2,pl.y+pl.h/2,8,'#88ccff');
    SFX.block();
    return;
  }

  if(pl.blocking&&pl.guardCooldown===0&&pl.guard>0){
    const guardDrain=Math.floor(dmg*0.6);
    pl.guard=Math.max(0,pl.guard-guardDrain);
    if(pl.guard<=0){ pl.blocking=false; pl.guardCooldown=42; }
    spawnParticles(pl.x+4,pl.y+pl.h/2,6,'#e8c830');
    SFX.block();
    dmg=dmg*0.25;
  }
  
  // Armor defense multiplier
  const armDef=1-(pl.armor?pl.armor.stats.def:0);
  
  let reducedDmg=dmg*armDef;
  if(rebirthAbilities.includes('iron_will')) reducedDmg*=0.75;
  if(pl.hollowSight&&B.phase===2) reducedDmg*=0.9;
  const finalDmg=Math.max(1,reducedDmg-pl.defense);
  pl.hp=Math.max(0,pl.hp-finalDmg);
  pl.iframes=20;
  spawnHitSparks(pl.x+pl.w/2,pl.y+pl.h/2,8,pl===P2?'#ff4488':'#ff4444');
  triggerScreenShake(finalDmg>30?6:3, finalDmg>30?10:6);

  // Floating damage on player
  const arena = document.getElementById('arena');
  if(arena){
    const arenaRect = arena.getBoundingClientRect();
    spawnDamageNumber(pl.x+pl.w/2+arenaRect.left, pl.y+arenaRect.top, finalDmg, 'boss');
  }
  SFX.playerHit();
  
  if(pl.hp<=0){
    if(rebirthAbilities.includes('undying_will')&&!pl.undyingUsed){
      pl.undyingUsed=true; pl.hp=Math.floor(pl.maxHp*0.20); pl.iframes=60;
      spawnParticles(pl.x+pl.w/2,pl.y+pl.h/2,20,'#ffff88');
      return;
    }
    pl.dead=true;
    SFX.death();
    // 2P: only game over when both dead
    const bothDead=P.dead&&(P2===null||P2.dead);
    if(bothDead){
      G.running=false;
      bossMusic.stop();
      if(survivalMode){ setTimeout(endSurvivalRun,800); return; }
      if(speedRunMode){ clearInterval(speedRunInterval); speedRunMode=false; }
      setTimeout(()=>{ showScreen('screen-defeat'); },800);
    } else if(pl===P2){
      // P2 died, show dead banner
      const banner=document.getElementById('p2-dead-banner');
      if(banner) banner.style.display='flex';
      showNotification('☠ P2 HAS FALLEN — P1 fights on alone!',3000);
    } else {
      // P1 died, if P2 alive continue
      if(P2&&!P2.dead){
        showNotification('☠ P1 HAS FALLEN — P2 fights on alone!',3000);
      } else {
        G.running=false;
        setTimeout(()=>{ showScreen('screen-defeat'); },800);
      }
    }
  }
}

function damageBoss(dmg){
  let finalDmg=Math.max(1,dmg);
  // War Axe armor shred: each stack = +10% damage taken
  if(B && B.armorShred) finalDmg *= (1 + B.armorShred * 0.10);
  // Age of Dark: +20% damage
  if(rebirthAbilities.includes('age_of_dark')) finalDmg*=1.2;
  // Hollow Sight: +10% when boss in phase 2
  if(P.hollowSight&&B.phase===2) finalDmg*=1.1;
  // Ember Edge: first attack triple damage
  if(P.emberEdge&&!P.emberEdgeUsed){ finalDmg*=3; P.emberEdgeUsed=true; }
  // Cursed Blade: stack curses
  if(P.cursedBlade){
    P.curseStacks=(P.curseStacks||0)+1;
    if(P.curseStacks>=5){ finalDmg+=50; P.curseStacks=0; }
  }
  finalDmg=Math.floor(finalDmg);
  B.hp=Math.max(0,B.hp-finalDmg);
  spawnParticles(B.x+B.w/2,B.y+B.h/2,6,'#ffaa00');

  // Floating damage number on boss
  const arena = document.getElementById('arena');
  if(arena){
    const arenaRect = arena.getBoundingClientRect();
    const isCrit = (finalDmg > dmg * 1.4);
    spawnDamageNumber(B.x+B.w/2+arenaRect.left, B.y+B.h*0.2+arenaRect.top, finalDmg, isCrit?'crit':'');
  }
  // Sound
  if(finalDmg > dmg * 1.4) { SFX.crit(); } else { SFX.hit(); }

  // Soulbond: heal on kill
  if(B.hp<=0&&P.soulbondActive){ P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*0.15)); }
  
  if(B.hp<=0&&!B.dying){
    B.dying=true; B.dyingTimer=0; B.hp=0;
    G.running=true; // keep running for death anim
    // Store victory data for after anim
    const soulReward=Math.floor(currentBoss.souls*(1+rebirthCount*0.2));
    const bonusSoul=rebirthAbilities.includes('soul_harvest')?Math.floor(soulReward*0.5):0;
    B._victoryData={soulReward,bonusSoul};
    SFX.bossRoar();
  }
}

function checkCollisions(){
  // Helper: check a player attacking boss
  function checkPlayerAttackBoss(pl){
    if(!pl||pl.dead) return;
    if(pl.attacking&&!B.inCombo){
      const dx=B.x-pl.x;
      const dist=Math.abs(dx);
      const windupDone=(pl.attackTimer||0)>=7;
      const weapon=pl.weapon||equippedWeapon;
      // Weapon reach
      const reach={sword:120,mace:110,bow:260,wand:300,katana:115,greatsword:140,spear:200,scythe:150,twinblades:110,crossbow:280,halberd:135,flail:130,dagger:100,rapier:125,waraxe:120};
      const attackRange=reach[weapon]||120;

      if(windupDone&&!pl.attackHit&&dist<attackRange){
        pl.attackHit=true;
        const crit=Math.random()<0.05?1.5:1;
        const darkFlame=rebirthAbilities.includes('dark_flame')&&Math.random()<0.15?10:0;
        const weapBonus=getWeaponDamageBonus(weapon);
        let dmg=(pl.atk*crit+darkFlame)*weapBonus;
        // Weapon-specific multipliers
        if(weapon==='greatsword') dmg*=2.0;
        if(weapon==='katana')     dmg*=0.45; // per-hit; fires 3 times
        if(weapon==='spear')      dmg*=0.9;
        if(weapon==='scythe')     dmg*=1.3;  // wide arc, hits everything nearby
        if(weapon==='twinblades') dmg*=0.35; // per-hit; fires 5 times
        if(weapon==='crossbow')   dmg*=0.7;  // per bolt; fires 3 quick bolts
        if(weapon==='halberd')    dmg*=1.8;  // slow but heavy
        if(weapon==='flail')      dmg*=1.1;  // stun weapon
        if(weapon==='dagger')     dmg*=0.28; // per-hit; fires 6 times, +backstab
        if(weapon==='rapier')     dmg*=1.2;  // piercing + high crit chance
        if(weapon==='waraxe')     dmg*=1.4;  // armor shred
        damageBoss(dmg);
        // Katana: queue 2 more rapid hits
        if(weapon==='katana'&&!pl.kataComboActive){
          pl.kataComboActive=true; pl.kataHits=2;
          const doKataHit=()=>{
            if(!G.running||pl.dead||!B||pl.kataHits<=0) return;
            pl.kataHits--;
            if(Math.abs(B.x-pl.x)<attackRange) damageBoss(dmg);
            spawnHitSparks(pl.x+pl.w,pl.y+pl.h*0.4,'#ddeeff',6);
            if(pl.kataHits>0) setTimeout(doKataHit,90);
            else pl.kataComboActive=false;
          };
          setTimeout(doKataHit,90);
        }
        // Twin Blades: 5-hit flurry + bleed DOT
        if(weapon==='twinblades'&&!pl.twinComboActive){
          pl.twinComboActive=true; pl.twinHits=4;
          const doTwinHit=()=>{
            if(!G.running||pl.dead||!B||pl.twinHits<=0) return;
            pl.twinHits--;
            if(Math.abs(B.x-pl.x)<attackRange) damageBoss(dmg);
            spawnHitSparks(pl.x+pl.w,pl.y+pl.h*0.4,'#ff4488',5);
            if(pl.twinHits>0) setTimeout(doTwinHit,70);
            else{
              pl.twinComboActive=false;
              // Bleed: 3 ticks of DOT
              if(B&&!B.dying){ let bleedTicks=3; const bleed=()=>{ if(!B||B.dying) return; damageBoss(dmg*0.5); spawnHitSparks(B.x+B.w/2,B.y+B.h*0.3,'#cc0044',4); if(--bleedTicks>0) setTimeout(bleed,500); }; setTimeout(bleed,300); }
            }
          };
          setTimeout(doTwinHit,70);
        }
        // Crossbow: 3 rapid bolts as projectiles
        if(weapon==='crossbow'&&!pl.xbowActive){
          pl.xbowActive=true;
          let shots=2;
          const doShot=()=>{
            if(!G.running||pl.dead||shots<=0) return;
            shots--;
            const dir=pl.x<(B?B.x:AW()/2)?1:-1;
            projectiles.push({x:pl.x+pl.w,y:pl.y+pl.h*0.35,vx:dir*14,vy:-1,dmg:dmg,from:'player',size:7,color:'#ffcc44',owner:pl});
            spawnHitSparks(pl.x+pl.w,pl.y+pl.h*0.35,'#ffcc44',3);
            if(shots>0) setTimeout(doShot,120);
            else pl.xbowActive=false;
          };
          setTimeout(doShot,120);
        }
        // Scythe: AoE sweep hits at wide range
        if(weapon==='scythe'){
          spawnHitSparks(pl.x+pl.w/2,pl.y+pl.h*0.4,'#aa44ff',10);
          // Also hits at 180px (wider arc bonus)
          if(B&&Math.abs(B.x-pl.x)<180&&dist>=attackRange) damageBoss(dmg*0.6);
        }
        // Halberd: knockback
        if(weapon==='halberd'&&B){
          B.x+=Math.sign(B.x-pl.x)*28;
          B.stateTimer=Math.max(B.stateTimer,18);
          B.state='idle'; B.inCombo=false;
          spawnHitSparks(B.x+B.w/2,B.y+B.h*0.35,'#ddaa44',14);
        }
        // Flail: stun boss briefly
        if(weapon==='flail'&&B){
          B.stateTimer=Math.max(B.stateTimer,30);
          B.state='idle'; B.inCombo=false; B.attackCooldown=Math.max(B.attackCooldown,35);
          spawnHitSparks(B.x+B.w/2,B.y+B.h*0.35,'#ccaa00',10);
          setTimeout(()=>showNotification('⛓ STUNNED!',800),50);
        }
        // Dagger: 6-hit ultra-fast flurry + backstab crit bonus
        if(weapon==='dagger'&&!pl.daggerComboActive){
          const critMult = dist < 80 ? 1.5 : 1.0; // backstab if very close
          pl.daggerComboActive=true; pl.daggerHits=5;
          const doDaggerHit=()=>{
            if(!G.running||pl.dead||!B||pl.daggerHits<=0) return;
            pl.daggerHits--;
            if(Math.abs(B.x-pl.x)<attackRange) damageBoss(dmg*critMult);
            spawnHitSparks(pl.x+pl.w,pl.y+pl.h*0.4,'#ffdd88',4);
            if(pl.daggerHits>0) setTimeout(doDaggerHit,55);
            else pl.daggerComboActive=false;
          };
          setTimeout(doDaggerHit,55);
        }
        // Rapier: 15% crit chance (on top of normal 5%) + pierces 30% defense
        if(weapon==='rapier'){
          if(Math.random()<0.15) setTimeout(()=>showNotification('🤺 PIERCING CRIT!',1200),50);
          // The pierce effect: deal bonus damage ignoring armor (already handled above)
        }
        // War Axe: stack armor shred on boss (up to 5 stacks, each -10% boss def)
        if(weapon==='waraxe'&&B){
          B.armorShred = Math.min(5, (B.armorShred||0)+1);
          spawnHitSparks(B.x+B.w/2,B.y+B.h*0.35,'#cc4400',9);
          if(B.armorShred===1) showNotification('🪓 ARMOR SHRED x1',900);
          else if(B.armorShred===5) showNotification('🪓 MAX SHRED! Boss armor destroyed!',1600);
          else showNotification(`🪓 ARMOR SHRED x${B.armorShred}`,900);
        }
        // Greatsword: brief stagger
        if(weapon==='greatsword'){
          B.stateTimer=Math.max(B.stateTimer,22);
          B.state='idle';
          B.inCombo=false;
          spawnHitSparks(B.x+B.w/2,B.y+B.h*0.35,'#ffcc44',12);
        }
        if(crit>1) setTimeout(()=>showNotification('💥 CRITICAL HIT!',1400),50);
        spawnHitSparks(B.x+B.w/2,B.y+pl.h*0.35,'#ffaa00',8);
        triggerScreenShake(4,6);
      }
      if(windupDone&&weapon==='mace'&&!pl.maceObHit){
        pl.maceObHit=true;
        obstacles.forEach(ob=>{
          if(ob.broken) return;
          const odx=Math.abs((ob.x+ob.w/2)-(pl.x+pl.w/2));
          if(odx<80){
            ob.hp--;
            spawnParticles(ob.x+ob.w/2,ob.y+ob.h/2,5,'#886644');
            if(ob.hp<=0){ ob.broken=true; spawnParticles(ob.x+ob.w/2,ob.y,14,'#aa8855'); }
          }
        });
      }
      if(!windupDone){ spawnParticles(pl.x+pl.w+10,pl.y+pl.h*0.4,1,'#ffcc44'); }
    } else if(pl.attacking&&B.inCombo){
      spawnParticles(B.x+B.w/2,B.y+B.h/2,3,'#ff6600');
    }
  }
  checkPlayerAttackBoss(P);
  checkPlayerAttackBoss(P2);

  // Boss leap landing damage
  if(B&&B.leaping&&B.onGround){
    B.leaping=false;
    triggerScreenShake(9,14);
    [P,P2].filter(pl=>pl&&!pl.dead).forEach(pl=>{
      if(Math.abs(pl.x-B.x)<140&&pl.iframes<=0) damagePlayer(B.leapDmg,pl);
    });
    spawnHitSparks(B.x+B.w/2,B.y+B.h,'#ffaa44',16);
  }

  // Projectile collisions
  projectiles.forEach((proj,i)=>{
    if(proj.from==='player'){
      const dx=B.x+B.w/2-proj.x,dy=B.y+B.h/2-proj.y;
      if(Math.abs(dx)<B.w/2&&Math.abs(dy)<B.h/2){
        if(!B.inCombo) damageBoss(proj.dmg);
        projectiles.splice(i,1); return;
      }
      obstacles.forEach(ob=>{
        if(ob.broken) return;
        if(proj.x>ob.x&&proj.x<ob.x+ob.w&&proj.y>ob.y&&proj.y<ob.y+ob.h){ projectiles.splice(i,1); }
      });
    } else if(proj.from==='boss'){
      // Hit any alive player
      [P,P2].filter(pl=>pl&&!pl.dead).forEach(pl=>{
        const dx=pl.x+pl.w/2-proj.x,dy=pl.y+pl.h/2-proj.y;
        if(Math.abs(dx)<pl.w/2&&Math.abs(dy)<pl.h/2&&pl.iframes<=0){
          damagePlayer(proj.dmg,pl);
          projectiles.splice(i,1);
        }
      });
      obstacles.forEach(ob=>{
        if(ob.broken) return;
        if(proj.x>ob.x&&proj.x<ob.x+ob.w&&proj.y>ob.y&&proj.y<ob.y+ob.h){ projectiles.splice(i,1); }
      });
    }
  });
}

function getWeaponDamageBonus(weapon){
  if(weapon==='sword')      return 1.2+(upgrades.swordDmg||0)*0.2;
  if(weapon==='mace')       return 1+(upgrades.maceDmg||0)*0.2;
  if(weapon==='bow')        return 1+(upgrades.bowDmg||0)*0.2;
  if(weapon==='wand')       return 1+(upgrades.wandPow||0)*0.25;
  if(weapon==='katana')     return 1+(upgrades.katanaDmg||0)*0.15;
  if(weapon==='greatsword') return 1+(upgrades.gswordDmg||0)*0.2;
  if(weapon==='spear')      return 1+(upgrades.spearDmg||0)*0.15;
  if(weapon==='scythe')     return 1+(upgrades.scytheDmg||0)*0.18;
  if(weapon==='twinblades') return 1+(upgrades.twinbladesDmg||0)*0.12;
  if(weapon==='crossbow')   return 1+(upgrades.crossbowDmg||0)*0.15;
  if(weapon==='halberd')    return 1+(upgrades.halberdDmg||0)*0.2;
  if(weapon==='flail')      return 1+(upgrades.flailDmg||0)*0.18;
  if(weapon==='dagger')     return 1+(upgrades.daggerDmg||0)*0.12;
  if(weapon==='rapier')     return 1+(upgrades.rapierDmg||0)*0.15;
  if(weapon==='waraxe')     return 1+(upgrades.waraxeDmg||0)*0.17;
  return 1;
}

function updateProjectiles(){
  const dt=G.dt||1;
  projectiles.forEach((proj,i)=>{
    proj.x+=proj.vx*dt;
    proj.y+=proj.vy*dt;
    if(proj.gravity) proj.vy+=0.35*dt;
    if(proj.x<0||proj.x>AW()||proj.y<0||proj.y>AH()) projectiles.splice(i,1);
  });
}

function updateParticles(){
  particles.forEach((p,i)=>{
    p.x+=p.vx;
    p.y+=p.vy;
    p.life--;
    p.alpha-=0.02;
    if(p.life<=0||p.alpha<=0) particles.splice(i,1);
  });
}

function spawnParticles(x,y,count,color){
  for(let i=0;i<count;i++){
    particles.push({
      x,y,
      vx:(Math.random()-0.5)*6,
      vy:(Math.random()-0.5)*6-2,
      size:Math.random()*4+2,
      color,
      alpha:1,
      life:30
    });
  }
}

function flash(type){
  const el=document.getElementById(type==='phase'?'phase-flash':type==='magic'?'magic-flash':type==='parry'?'parry-flash':'attack-flash');
  if(!el) return;
  el.style.opacity=type==='phase'?'0.6':type==='parry'?'0.7':'0.4';
  setTimeout(()=>el.style.opacity='0',type==='parry'?200:120);
}

function triggerScreenShake(intensity,frames){
  screenShake.intensity=intensity;
  screenShake.frames=frames;
}

function spawnHitSparks(x,y,color,count){
  for(let i=0;i<count;i++){
    const angle=Math.random()*Math.PI*2;
    const spd=2+Math.random()*7;
    particles.push({
      x,y,
      vx:Math.cos(angle)*spd,
      vy:Math.sin(angle)*spd-2,
      size:Math.random()*5+2,
      color,
      alpha:1,
      life:24+Math.floor(Math.random()*16)
    });
  }
  // Add a few white core sparks
  for(let i=0;i<Math.ceil(count/3);i++){
    const angle=Math.random()*Math.PI*2;
    const spd=3+Math.random()*5;
    particles.push({x,y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd-3,
      size:Math.random()*3+1,color:'#ffffff',alpha:0.9,life:14});
  }
}

function endBossDeath(){
  const {soulReward,bonusSoul}=B._victoryData||{soulReward:0,bonusSoul:0};
  G.running=false;
  bossMusic.stop();
  totalSouls+=soulReward+bonusSoul;
  if(!defeatedBosses.includes(currentBoss.id)) defeatedBosses.push(currentBoss.id);
  saveGame(); // persist souls + defeated bosses
  try{ addToGlobalSouls(soulReward+bonusSoul); }catch(e){} // add to shared global counter (non-blocking)

  const killTime=Math.floor((Date.now()-fightStartTime)/1000);
  _pendingLbEntry={
    boss:currentBoss.name, bossId:currentBoss.id,
    time:killTime, souls:soulReward+bonusSoul,
    mode:bossRushMode?'rush':survivalMode?'survival':speedRunMode?'speedrun':gameMode,
    weapon:equippedWeapon, rebirth:rebirthCount,
    date:new Date().toLocaleDateString()
  };

  // Check achievements
  checkAchievements();

  if(bossRushMode){
    bossRushSouls+=soulReward+bonusSoul;
    bossRushIndex++;
    lbSaveEntry({..._pendingLbEntry, rushIndex:bossRushIndex});
    _pendingLbEntry=null;
    SFX.victory();
    if(bossRushIndex>=BOSSES.length){
      const totalTime=Math.floor((Date.now()-bossRushStartTime)/1000);
      lbSaveEntry({boss:'BOSS RUSH COMPLETE',bossId:'rush',time:totalTime,souls:bossRushSouls,mode:'rush',weapon:equippedWeapon,rebirth:rebirthCount,date:new Date().toLocaleDateString()});
      setTimeout(()=>{
        showScreen('screen-victory');
        document.getElementById('victory-reward').textContent=`BOSS RUSH COMPLETE!\n+${bossRushSouls.toLocaleString()} SOULS\nTime: ${lbFormatTime(totalTime)}`;
        bossRushMode=false;
      },400);
    } else {
      setTimeout(startNextRushBoss,600);
    }
    return;
  }

  if(survivalMode){
    survivalSouls+=soulReward+bonusSoul;
    totalSouls+=soulReward+bonusSoul;
    lbSaveEntry({..._pendingLbEntry});
    _pendingLbEntry=null;
    updateRushHUD();
    setTimeout(nextSurvivalWave,600);
    return;
  }

  if(speedRunMode){
    speedRunSouls+=soulReward+bonusSoul;
    totalSouls+=soulReward+bonusSoul;
    lbSaveEntry({..._pendingLbEntry});
    _pendingLbEntry=null;
    setTimeout(nextSpeedRunBoss,600);
    return;
  }

  // Show name entry then victory
  showNameModal(()=>{
    SFX.victory();
    showScreen('screen-victory');
    document.getElementById('victory-reward').textContent=
      `${currentBoss.name} DEFEATED\n+${(soulReward+bonusSoul).toLocaleString()} SOULS${bonusSoul>0?' (+50% BONUS!)':''}`;
    const ngBtn=document.getElementById('ngplus-btn');
    if(ngBtn) ngBtn.style.display=defeatedBosses.length>=BOSSES.length?'inline-block':'none';
    const copyBtn=document.getElementById('copy-result-btn');
    if(copyBtn) copyBtn.style.display='inline-block';
    if(defeatedBosses.length>=BOSSES.length){
      unlockAchievement('all_bosses');
    }
  });
}

// ── PARRY SYSTEM ──
// Player presses F within first 14 frames of a boss attack → parry!
// Then press J within 60 frames → riposte (3× damage)
function tryParry(pl){
  if(!pl||pl.dead||!B||!G.running) return;
  if(pl.parryWindow>0){ // riposte
    const weapBonus=getWeaponDamageBonus(pl.weapon||equippedWeapon);
    damageBoss(pl.atk*3*weapBonus);
    pl.parryWindow=0; pl.parryRiposted=true;
    spawnHitSparks(B.x+B.w/2,B.y+B.h*0.3,'#ffff00',16);
    triggerScreenShake(8,12);
    showNotification('⚔ RIPOSTE!',1600);
    unlockAchievement('parry_master');
    B.stateTimer=Math.max(B.stateTimer,40); B.state='idle'; B.inCombo=false;
    return;
  }
  // Check if boss is in early attack wind-up
  if(B.state==='attack'&&B.stateTimer>0){
    const isEarlyFrames = B.comboHitsLeft===B.comboTotal||(B.stateTimer>=(B.comboTotal*20));
    if(isEarlyFrames||(B.attackCooldown>0&&B.attackCooldown>60)){
      // Successful parry
      pl.parryWindow=60; // frames to land riposte
      pl.parryRiposted=false;
      B.state='idle'; B.stateTimer=30; B.inCombo=false; B.comboHitsLeft=0;
      flash('parry');
      SFX.parry();
      spawnHitSparks(pl.x+pl.w/2,pl.y+pl.h*0.3,'#ffff44',12);
      triggerScreenShake(5,8);
      showNotification('🛡 PARRIED! — Press J to RIPOSTE',2200);
    }
  }
}

// Tick parry window down
function tickParry(pl){
  if(!pl) return;
  if(pl.parryWindow>0) pl.parryWindow--;
}

function updateWeaponHUD(pl, prefix){
  const wNames={sword:'SWORD',mace:'MACE',bow:'BOW',wand:'WAND',katana:'KATANA',greatsword:'GRSWORD',spear:'SPEAR',scythe:'SCYTHE',twinblades:'TWINBLD',crossbow:'XBOW',halberd:'HALBERD',flail:'FLAIL',dagger:'DAGGER',rapier:'RAPIER',waraxe:'WARAXE'};
  const wIcons={sword:'⚔',mace:'🔨',bow:'🏹',wand:'🪄',katana:'🗡️',greatsword:'⚔',spear:'🔱',scythe:'🌙',twinblades:'⚡',crossbow:'🎯',halberd:'🪓',flail:'⛓',dagger:'🔪',rapier:'🤺',waraxe:'🪓'};
  const weapon=pl===P?equippedWeapon:equippedWeapon2;
  const wi=document.getElementById(`${prefix}-weap-icon`);
  const wn=document.getElementById(`${prefix}-weap-name`);
  if(wi) wi.textContent=wIcons[weapon]||'⚔';
  if(wn) wn.textContent=wNames[weapon]||'SWORD';
}

function updatePlayerHUD(){
  if(!P) return;
  const pct=v=>Math.max(0,Math.min(100,(v||0)*100))+'%';
  document.getElementById('hp-in').style.width=pct(P.hp/P.maxHp);
  document.getElementById('stam-in').style.width=pct(P.stamina/P.maxStamina);
  document.getElementById('mp-in').style.width=pct(P.mp/P.maxMp);
  const gi=document.getElementById('guard-in');
  gi.style.width=pct(P.guard/P.maxGuard);
  gi.className='guard-bar'+(P.guardCooldown>0?' cooldown':'');
  const pips=document.getElementById('estus-pips');
  pips.innerHTML='';
  for(let i=0;i<P.maxEstus;i++){
    const pip=document.createElement('div');
    pip.className='estus-pip'+(i>=P.estus?' empty':'');
    pips.appendChild(pip);
  }
  updateSoulsDisplay();

  if(P2){
    document.getElementById('hp2-in').style.width=pct(P2.hp/P2.maxHp);
    document.getElementById('stam2-in').style.width=pct(P2.stamina/P2.maxStamina);
    document.getElementById('mp2-in').style.width=pct(P2.mp/P2.maxMp);
    const gi2=document.getElementById('guard2-in');
    gi2.style.width=pct(P2.guard/P2.maxGuard);
    gi2.className='guard-bar'+(P2.guardCooldown>0?' cooldown':'');
    const pips2=document.getElementById('estus2-pips');
    pips2.innerHTML='';
    for(let i=0;i<P2.maxEstus;i++){
      const pip=document.createElement('div');
      pip.className='estus-pip'+(i>=P2.estus?' empty':'');
      pips2.appendChild(pip);
    }
  }
}

function updateBossHP(){
  const pct=(B.hp/B.maxHp*100);
  document.getElementById('boss-hp-fill').style.width=pct+'%';
  document.getElementById('boss-hp-pct').textContent=Math.ceil(pct)+'%';
  
  const sep=document.getElementById('boss-hp-sep');
  if(B.phase===2){
    sep.style.display='block';
    sep.style.left='50%';
  }
}

// ============================================================
// DRAWING
// ============================================================
function drawPlayer(ctx, pl, isP2){
  if(!pl) return;
  const arm=pl.armor||ARMOR_DATA[0];
  const weapon=pl.weapon||equippedWeapon;
  const flashing=pl.dead||(pl.iframes%4<2&&pl.iframes>0);
  const bodyC=flashing?'#ffffff':arm.bodyC;
  const headC=arm.headC;
  const shieldC=pl.blocking?(pl.guardCooldown>0?'#663300':'#e8c830'):arm.bodyC;
  const x=pl.x, y=pl.y;

  // P2 tint overlay
  if(isP2){ ctx.globalAlpha=pl.dead?0.3:1; }

  // === DRAW HELMET by type ===
  const ht=arm.helmType||'open';
  if(ht==='full'){
    // Full enclosed helm
    px(ctx,x+12,y-2,24,20,bodyC);
    px(ctx,x+14,y+4,6,6,'#113');  // visor slot L
    px(ctx,x+28,y+4,6,6,'#113');  // visor slot R
    px(ctx,x+10,y-4,28,6,bodyC);  // top cap
  } else if(ht==='half'){
    // Half helm with gold visor
    px(ctx,x+14,y,20,12,bodyC);
    px(ctx,x+12,y+8,24,10,headC);
    px(ctx,x+12,y,24,4,'#c8a840'); // gold trim
  } else if(ht==='hood'){
    // Dark hood
    px(ctx,x+10,y-4,28,20,bodyC);
    px(ctx,x+14,y+6,20,12,headC);
    ctx.globalAlpha=(isP2?1:1)*0.4;
    px(ctx,x+8,y-6,32,24,bodyC);
    ctx.globalAlpha=isP2?1:1;
  } else if(ht==='hat'){
    // Pointed sorcerer hat
    px(ctx,x+16,y-12,16,6,bodyC);
    px(ctx,x+14,y-6,20,4,bodyC);
    px(ctx,x+12,y-2,24,10,bodyC);
    px(ctx,x+14,y+8,20,10,headC);
    // Magic star on hat
    ctx.globalAlpha=0.7;
    px(ctx,x+22,y-10,4,4,'#88ccff');
    ctx.globalAlpha=isP2?1:1;
  } else {
    // Open face (default hollow)
    px(ctx,x+14,y,20,18,headC);
  }

  // === BODY ===
  px(ctx,x+10,y+18,28,26,bodyC);
  px(ctx,x+12,y+20,24,10,bodyC==='#ffffff'?'#ddddff':arm.bodyC);
  // Gold traced chest detail
  if(arm.key==='gold_traced'){
    ctx.globalAlpha=0.5;
    px(ctx,x+12,y+18,26,2,'#c8a840');
    px(ctx,x+18,y+20,12,14,'#8a6020');
    ctx.globalAlpha=1;
  }
  // Sorcerer star on robe
  if(arm.key==='sorcerer'){
    ctx.globalAlpha=0.5;
    px(ctx,x+18,y+24,12,12,'#1a3366');
    ctx.globalAlpha=0.8;
    px(ctx,x+22,y+26,4,4,'#88aaff');
    ctx.globalAlpha=1;
  }

  // === WEAPON ===
  if(weapon==='sword'){
    if(pl.attacking){
      px(ctx,x+38,y-10,6,34,'#cccccc'); // blade
      px(ctx,x+36,y-12,10,8,'#888888'); // guard
      ctx.globalAlpha=0.4;
      px(ctx,x+40,y-10,2,30,'#ffffff'); // edge shimmer
      ctx.globalAlpha=1;
    } else {
      px(ctx,x+38,y+10,5,30,'#cccccc');
    }
  } else if(weapon==='mace'){
    if(pl.attacking){
      px(ctx,x+36,y-4,14,12,'#998844'); // heavy head
      px(ctx,x+40,y+8,6,26,'#776633');  // handle
      // Impact sparks
      ctx.globalAlpha=0.6;
      for(let i=0;i<3;i++) px(ctx,x+34+i*6,y-6,4,4,'#ffcc44');
      ctx.globalAlpha=1;
    } else {
      px(ctx,x+38,y+8,8,24,'#776633');
      px(ctx,x+36,y+6,12,8,'#998844');
    }
  } else if(weapon==='bow'){
    // Bow on back, arrow nocked
    if(pl.attacking){
      // Arrow release
      ctx.globalAlpha=0.8;
      px(ctx,x+40,y+14,24,2,'#886633'); // arrow flying
      ctx.globalAlpha=0.5;
      px(ctx,x+60,y+12,8,6,'#886633');  // arrow head
      ctx.globalAlpha=1;
    }
    // Bow always visible on side
    ctx.globalAlpha=0.7;
    px(ctx,x+4,y+12,3,32,'#8a6030');   // bow stave
    px(ctx,x+4,y+12,6,2,'#886030');    // top curve
    px(ctx,x+4,y+42,6,2,'#886030');    // bottom curve
    ctx.globalAlpha=1;
  } else if(weapon==='wand'){
    if(pl.attacking||pl.casting){
      px(ctx,x+38,y-4,4,36,'#7744aa');
      ctx.globalAlpha=0.9;
      px(ctx,x+36,y-8,8,8,'#aa44ff');
      ctx.globalAlpha=0.4;
      px(ctx,x+34,y-10,12,12,'#cc66ff');
      ctx.globalAlpha=1;
    } else {
      px(ctx,x+38,y+8,3,30,'#7744aa');
      ctx.globalAlpha=0.6;
      px(ctx,x+36,y+6,6,6,'#aa44ff');
      ctx.globalAlpha=1;
    }
  } else if(weapon==='katana'){
    if(pl.attacking){
      // Katana slash — thin, angled
      ctx.save();
      ctx.translate(x+36,y+10);
      ctx.rotate(-0.5);
      px(ctx,0,-38,3,46,'#ddeeff');
      ctx.globalAlpha=0.5;
      px(ctx,1,-38,1,44,'#ffffff');
      ctx.globalAlpha=0.3;
      px(ctx,-4,-44,10,8,'#aaccff'); // guard
      ctx.globalAlpha=1;
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(x+38,y+12); ctx.rotate(-0.3);
      px(ctx,0,0,2,36,'#ddeeff');
      ctx.restore();
    }
  } else if(weapon==='greatsword'){
    if(pl.attacking){
      px(ctx,x+26,y-20,12,60,'#bbbbcc');
      px(ctx,x+22,y-22,20,14,'#887766'); // crossguard
      ctx.globalAlpha=0.6;
      px(ctx,x+29,y-20,4,58,'#ffffff'); // edge
      for(let i=0;i<3;i++) px(ctx,x+20+i*8,y-24,6,6,'#ffcc44'); // impact sparks
      ctx.globalAlpha=1;
    } else {
      px(ctx,x+32,y+4,8,50,'#bbbbcc');
      px(ctx,x+28,y+4,16,8,'#887766');
    }
  } else if(weapon==='spear'){
    if(pl.attacking){
      px(ctx,x+36,y+14,4,56,'#8a7040'); // shaft
      px(ctx,x+34,y-4,8,20,'#cccccc'); // blade
      ctx.globalAlpha=0.4; px(ctx,x+37,y-4,2,22,'#ffffff'); ctx.globalAlpha=1;
    } else {
      px(ctx,x+36,y+16,3,48,'#8a7040');
      px(ctx,x+34,y+14,6,6,'#cccccc');
    }
  } else if(weapon==='scythe'){
    if(pl.attacking){
      // Curved scythe blade + long staff
      ctx.save(); ctx.translate(x+36,y+10); ctx.rotate(-0.6);
      px(ctx,0,0,3,54,'#6a5030'); // staff
      ctx.restore();
      px(ctx,x+24,y-8,28,6,'#aaaacc'); // blade
      px(ctx,x+22,y-14,6,18,'#aaaacc'); // hook curve
      ctx.globalAlpha=0.5; px(ctx,x+26,y-10,24,3,'#ffffff'); ctx.globalAlpha=1;
      ctx.globalAlpha=0.3; px(ctx,x+18,y-10,36,22,'#8844ff'); ctx.globalAlpha=1; // aura
    } else {
      ctx.save(); ctx.translate(x+36,y+14); ctx.rotate(-0.3);
      px(ctx,0,0,2,48,'#6a5030');
      ctx.restore();
      px(ctx,x+24,y+2,24,5,'#aaaacc');
    }
  } else if(weapon==='twinblades'){
    if(pl.attacking){
      // Two short blades
      px(ctx,x+34,y-12,3,32,'#ccddff'); // blade 1
      px(ctx,x+42,y-6,3,32,'#ffccdd');  // blade 2 offset
      ctx.globalAlpha=0.6;
      px(ctx,x+35,y-12,1,30,'#ffffff');
      px(ctx,x+43,y-6,1,30,'#ffffff');
      ctx.globalAlpha=0.3;
      px(ctx,x+30,y-14,18,36,'#ff4488'); // pink aura
      ctx.globalAlpha=1;
    } else {
      px(ctx,x+34,y,3,28,'#ccddff');
      px(ctx,x+42,y+4,3,28,'#ffccdd');
    }
  } else if(weapon==='crossbow'){
    if(pl.attacking){
      px(ctx,x+30,y+14,24,6,'#884422');   // stock
      px(ctx,x+50,y+10,8,14,'#aaaaaa');   // prod arms
      px(ctx,x+50,y+10,4,14,'#aaaaaa');
      px(ctx,x+52,y+16,2,30,'#998866');   // tiller
      ctx.globalAlpha=0.8;
      px(ctx,x+54,y+16,3,6,'#ffcc44');     // bolt
      ctx.globalAlpha=1;
    } else {
      px(ctx,x+30,y+16,22,5,'#884422');
      px(ctx,x+50,y+12,7,12,'#aaaaaa');
      px(ctx,x+52,y+18,2,24,'#998866');
    }
  } else if(weapon==='halberd'){
    if(pl.attacking){
      px(ctx,x+36,y+8,4,60,'#7a6040');   // long shaft
      px(ctx,x+28,y-16,12,32,'#bbbbcc'); // axe head
      px(ctx,x+38,y-18,6,22,'#ccccdd'); // spike top
      ctx.globalAlpha=0.5; px(ctx,x+30,y-16,8,30,'#ffffff'); ctx.globalAlpha=1;
      ctx.globalAlpha=0.2; px(ctx,x+24,y-18,20,40,'#ddaa44'); ctx.globalAlpha=1;
    } else {
      px(ctx,x+38,y+10,3,52,'#7a6040');
      px(ctx,x+30,y-4,10,24,'#bbbbcc');
      px(ctx,x+40,y-6,5,16,'#ccccdd');
    }
  } else if(weapon==='flail'){
    if(pl.attacking){
      // Flail: handle + chain + ball
      px(ctx,x+36,y+12,4,32,'#6a5030'); // handle
      // Chain links
      for(let i=0;i<4;i++) px(ctx,x+35+i%2*3,y-4+i*8,4,4,'#aaaaaa');
      // Spiked ball
      circ(ctx,x+36,y-16,7,'#888888');
      px(ctx,x+32,y-22,6,6,'#999999');
      ctx.globalAlpha=0.4; px(ctx,x+28,y-22,16,16,'#ffaa00'); ctx.globalAlpha=1;
    } else {
      px(ctx,x+36,y+14,4,28,'#6a5030');
      for(let i=0;i<3;i++) px(ctx,x+35,y+4+i*6,4,4,'#aaaaaa');
      circ(ctx,x+36,y,6,'#888888');
    }
  } else if(weapon==='dagger'){
    if(pl.attacking){
      px(ctx,x+38,y-6,3,28,'#dddddd'); // blade
      px(ctx,x+34,y+14,10,4,'#775533'); // crossguard
      px(ctx,x+38,y+18,3,12,'#884422'); // grip
      ctx.globalAlpha=0.5; px(ctx,x+39,y-6,1,26,'#ffffff'); ctx.globalAlpha=1;
      ctx.globalAlpha=0.3; px(ctx,x+34,y-8,10,34,'#ffff88'); ctx.globalAlpha=1;
    } else {
      px(ctx,x+40,y+2,2,22,'#dddddd');
      px(ctx,x+37,y+18,8,3,'#775533');
      px(ctx,x+40,y+21,2,10,'#884422');
    }
  } else if(weapon==='rapier'){
    if(pl.attacking){
      // Long thin thrusting blade
      px(ctx,x+28,y+10,48,2,'#ddddee'); // blade (horizontal thrust)
      px(ctx,x+26,y+6,6,10,'#aaaacc');  // cup guard
      px(ctx,x+30,y+10,4,6,'#886644'); // ricasso
      ctx.globalAlpha=0.6; px(ctx,x+32,y+9,44,4,'#ffffff'); ctx.globalAlpha=0.2; px(ctx,x+28,y+6,50,12,'#aaccff'); ctx.globalAlpha=1;
    } else {
      px(ctx,x+36,y+4,2,42,'#ddddee');
      px(ctx,x+32,y+4,8,8,'#aaaacc');
    }
  } else if(weapon==='waraxe'){
    if(pl.attacking){
      px(ctx,x+36,y+4,4,52,'#7a5030'); // axe handle
      px(ctx,x+18,y-4,22,28,'#aaaacc'); // large axe head
      px(ctx,x+16,y-8,8,10,'#ccccdd'); // top spike
      ctx.globalAlpha=0.5; px(ctx,x+16,y-4,24,28,'#ffffff'); ctx.globalAlpha=1;
      ctx.globalAlpha=0.2; px(ctx,x+14,y-8,28,40,'#cc4400'); ctx.globalAlpha=1;
    } else {
      px(ctx,x+38,y+8,3,46,'#7a5030');
      px(ctx,x+22,y+2,18,22,'#aaaacc');
      px(ctx,x+20,y-2,6,8,'#ccccdd');
    }
  }

  // === SHIELD ===
  if(pl.blocking&&pl.guardCooldown===0){
    px(ctx,x+2,y+6,10,38,shieldC);
    px(ctx,x+0,y+4,14,6,shieldC);
    ctx.globalAlpha=0.4;
    px(ctx,x+4,y+8,4,28,'#ffffaa');
    ctx.globalAlpha=1;
  } else if(pl.guardCooldown>0){
    px(ctx,x+4,y+30,8,18,'#662200');
  } else {
    px(ctx,x+4,y+18,8,20,bodyC);
  }

  // === LEGS ===
  const lw=Math.abs(pl.vx)>0.5||Math.abs(pl.vy)>0.5?Math.floor(G.frame/8)%2*4:0;
  px(ctx,x+12,y+44,10,24,bodyC);
  px(ctx,x+26,y+44+lw,10,24,bodyC);

  // P2 rose tint
  if(isP2){
    ctx.globalAlpha=pl.dead?0.4:0.15;
    px(ctx,x,y-12,pl.w,pl.h+12,'#cc4466');
    ctx.globalAlpha=1;
  }

  // Player label above head
  ctx.save();
  ctx.globalAlpha=0.8;
  ctx.fillStyle=isP2?'#cc4466':'#4488cc';
  ctx.font=`${Math.floor(AW()*0.01)+4}px 'Press Start 2P', monospace`;
  ctx.textAlign='center';
  ctx.fillText(isP2?'P2':'P1',x+pl.w/2,y-14);
  ctx.restore();

  ctx.globalAlpha=1;
}

function drawObstacles(ctx){
  // Grab arena theme accent for tinting
  const themeAccents={
    vordt:'#224466',sister_friede:'#1a2a3a',nameless_king:'#2a2000',
    gwyn:'#2a1a00',soul_of_cinder:'#2a1800',champion_gundyr:'#1a0800',
    manus:'#0d0020',four_kings:'#0d0020',aldrich:'#0d0020',darklurker:'#000018',
    greatwood:'#0a1a0a',oceiros:'#0a1a08',sif:'#0a140a',
    dancer:'#1a0020',pontiff:'#100018',twin_princes:'#100018',fume_knight:'#100010',
    nashandra:'#160006',abyss_watchers:'#1a0000',
    velstadt:'#1a1400',demon_prince:'#1a0400',halflight:'#080e1a',
    gael:'#1a0008',friede_final:'#080814',priscilla:'#1a1020',quelaag:'#1a0800',moonlight_butterfly:'#080e1a',
  };
  const bt=currentBoss?currentBoss.type:'iudex';
  const tint=themeAccents[bt]||'#1a1408';

  obstacles.forEach(ob=>{
    if(ob.broken){
      // Draw rubble pile where it was
      ctx.globalAlpha=0.5;
      for(let i=0;i<5;i++) px(ctx,ob.x+i*Math.floor(ob.w/5),ob.y+ob.h-10+((i%2)*6),Math.floor(ob.w/5)-2,10+((i%2)*4),tint==='#1a1408'?'#3a3020':'#2a2818');
      ctx.globalAlpha=1;
      return;
    }
    const cracked=ob.hp<ob.maxHp;
    const type=ob.type||'pillar';

    if(type==='pillar'){
      // Tall stone pillar with capital
      const mid='#504438', light='#7a6a55', dark='#302820', cap='#604e38';
      px(ctx,ob.x,ob.y,ob.w,ob.h,mid);
      px(ctx,ob.x,ob.y,4,ob.h,light);              // left highlight
      px(ctx,ob.x+ob.w-4,ob.y,4,ob.h,dark);        // right shadow
      // Capital (top ornament)
      px(ctx,ob.x-5,ob.y,ob.w+10,10,cap);
      px(ctx,ob.x-5,ob.y,ob.w+10,3,light);
      px(ctx,ob.x-3,ob.y+10,ob.w+6,4,dark);
      // Base
      px(ctx,ob.x-4,ob.y+ob.h-8,ob.w+8,8,cap);
      // Stone texture bands
      for(let i=1;i<4;i++){
        ctx.globalAlpha=0.2;
        px(ctx,ob.x+4,ob.y+i*(ob.h/4),ob.w-8,2,dark);
        ctx.globalAlpha=1;
      }
      // Tint overlay (boss theme)
      ctx.globalAlpha=0.14;
      px(ctx,ob.x,ob.y,ob.w,ob.h,tint);
      ctx.globalAlpha=1;

    } else if(type==='wall'){
      // Low wide ruined wall
      const mid='#484030', light='#6a5e48', dark='#282418', cap='#584a34';
      px(ctx,ob.x,ob.y,ob.w,ob.h,mid);
      px(ctx,ob.x,ob.y,ob.w,4,light);              // top face
      px(ctx,ob.x,ob.y,4,ob.h,light);              // left face
      px(ctx,ob.x+ob.w-4,ob.y,4,ob.h,dark);
      // Jagged broken top edge
      for(let i=0;i<Math.floor(ob.w/12);i++){
        const jh=4+((i*7+3)%8);
        px(ctx,ob.x+i*12,ob.y-jh,10,jh+2,mid);
        px(ctx,ob.x+i*12,ob.y-jh,10,3,light);
      }
      // Brick lines
      for(let row=0;row<Math.floor(ob.h/12);row++){
        ctx.globalAlpha=0.25;
        for(let col=0;col<Math.floor(ob.w/20);col++){
          const bx=ob.x+(col*20)+((row%2)*10);
          px(ctx,bx,ob.y+row*12,18,10,dark);
        }
        ctx.globalAlpha=1;
      }
      ctx.globalAlpha=0.12; px(ctx,ob.x,ob.y,ob.w,ob.h,tint); ctx.globalAlpha=1;

    } else if(type==='rubble'){
      // Low wide rubble heap — irregular, can't be jumped on top of neatly
      const c1='#483c2c', c2='#604e38', c3='#302418';
      // Base mound
      px(ctx,ob.x,ob.y+8,ob.w,ob.h-8,c1);
      px(ctx,ob.x,ob.y,ob.w,10,c2);
      // Individual stone chunks on top
      const chunks=Math.floor(ob.w/16);
      for(let i=0;i<chunks;i++){
        const cx=ob.x+4+i*Math.floor((ob.w-8)/chunks);
        const ch=10+((i*13+7)%14);
        const cw=10+((i*7+5)%10);
        px(ctx,cx,ob.y-ch+10,cw,ch,i%2===0?c2:c1);
        px(ctx,cx,ob.y-ch+10,cw,3,c2==='#604e38'?'#7a6448':c2);
      }
      // Dust/dirt at base
      ctx.globalAlpha=0.3;
      px(ctx,ob.x-4,ob.y+ob.h-6,ob.w+8,6,c3);
      ctx.globalAlpha=0.1; px(ctx,ob.x,ob.y,ob.w,ob.h,tint); ctx.globalAlpha=1;

    } else if(type==='platform'){
      // Medium raised platform — wide flat top, good for jumping on
      const top='#5a5040', mid='#3e342a', light='#7a6a55', dark='#2a2018';
      // Support columns underneath
      const colW=10, cols=Math.floor(ob.w/32);
      for(let i=0;i<=cols;i++){
        const cx=ob.x+4+i*Math.floor((ob.w-8)/(cols||1));
        px(ctx,cx,ob.y+ob.h*0.3,colW,ob.h*0.7,mid);
        px(ctx,cx,ob.y+ob.h*0.3,3,ob.h*0.7,light);
      }
      // Platform slab
      px(ctx,ob.x,ob.y,ob.w,ob.h*0.35,top);
      px(ctx,ob.x,ob.y,ob.w,4,light);           // top surface highlight
      px(ctx,ob.x,ob.y,3,ob.h*0.35,light);      // left edge
      px(ctx,ob.x+ob.w-3,ob.y,3,ob.h*0.35,dark); // right shadow
      px(ctx,ob.x-3,ob.y+ob.h*0.35-4,ob.w+6,4,dark); // underside lip
      // Surface detail — engraved lines
      ctx.globalAlpha=0.2;
      for(let i=1;i<3;i++) px(ctx,ob.x+8,ob.y+i*(ob.h*0.35/3),ob.w-16,2,dark);
      ctx.globalAlpha=0.16; px(ctx,ob.x,ob.y,ob.w,ob.h*0.35,tint); ctx.globalAlpha=1;
    }

    // Crack effect if damaged
    if(cracked){
      ctx.globalAlpha=0.8;
      px(ctx,ob.x+Math.floor(ob.w*0.3),ob.y+6,2,ob.h*0.5,'#111008');
      px(ctx,ob.x+Math.floor(ob.w*0.6),ob.y+3,2,ob.h*0.35,'#111008');
      ctx.globalAlpha=1;
      // HP pips
      for(let i=0;i<ob.maxHp;i++){
        px(ctx,ob.x+4+i*8,ob.y-8,6,4,i<ob.hp?'#ffaa00':'#330000');
      }
    }
  });
}

function drawBoss(ctx){
  if(!B) return;
  const t=currentBoss.type,x=B.x,y=B.y,s=B.state;
  const D={
    asylum_demon:  drawAsylumDemon,
    capra_demon:   drawCapraDemon,
    seath:         drawSeath,
    four_kings:    drawFourKings,
    nashandra:     drawNashandra,
    aldrich:       drawAldrich,
    yhorm:         drawYhorm,
    dancer:        drawDancer,
    soul_of_cinder:drawSoulOfCinder,
    midir:         drawMidir,
    iudex:         drawIudex,
    vordt:         drawVordt,
    greatwood:     drawGreatwood,
    sif:           drawSif,
    stray_demon:   drawStrayDemon,
    ornstein:      drawOrnstein,
    artorias:      drawArtorias,
    manus:         drawManus,
    gwyn:          drawGwyn,
    pontiff:       drawPontiff,
    dragonslayer:  drawDragonslayer,
    twin_princes:  drawTwinPrinces,
    oceiros:       drawOceiros,
    abyss_watchers:drawAbyssWatchers,
    champion_gundyr:drawChampionGundyr,
    sister_friede:  drawSisterFriede,
    nameless_king:  drawNamelessKing,
    fume_knight:    drawFumeKnight,
    darklurker:     drawDarklurker,
    velstadt:       drawVelstadt,
    demon_prince:   drawDemonPrince,
    halflight:      drawHalflight,
    gael:           drawGael,
    friede_final:   drawFriedeFinal,
    priscilla:      drawPriscilla,
    quelaag:        drawQuelaag,
    moonlight_butterfly: drawMoonlightButterfly,
  };
  const fn=D[t]||drawAsylumDemon;

  // Theme accent colours for boss auras
  const bossAuras={
    iudex:'#cc8800',vordt:'#44aaff',greatwood:'#44cc44',sif:'#88ccaa',
    stray_demon:'#ff5500',ornstein:'#ddaa00',artorias:'#8844cc',manus:'#aa00ff',
    gwyn:'#ffcc44',asylum_demon:'#ff4400',capra_demon:'#cc4400',seath:'#44ccff',
    four_kings:'#8800ff',nashandra:'#cc0088',aldrich:'#8800ff',yhorm:'#ff6600',
    dancer:'#cc00ff',soul_of_cinder:'#ffaa00',midir:'#6600cc',pontiff:'#aa44ff',
    dragonslayer:'#4499ff',twin_princes:'#cc44ff',oceiros:'#66dd22',
    abyss_watchers:'#cc2200',champion_gundyr:'#ff4400',sister_friede:'#44aaff',
    nameless_king:'#ffcc00',fume_knight:'#cc44cc',darklurker:'#4466ff',
    velstadt:'#886622',demon_prince:'#ff4400',halflight:'#aaddff',gael:'#cc0022',friede_final:'#4444cc',priscilla:'#ffaacc',quelaag:'#ff6600',moonlight_butterfly:'#88ccff',
  };
  const auraCol = bossAuras[t]||'#cc8800';

  // Ground shadow
  const floorY = AH()-68;
  bossShadow(ctx, x+B.w/2, floorY, B.w*0.65, 10);

  // Phase 2: pulsing outer aura ring
  if(B.phase===2){
    const pulse = 55 + Math.sin(G.frame*0.09)*12;
    bossGlow(ctx, x+B.w/2, y+B.h*0.45, pulse, auraCol, 0.18);
    bossGlow(ctx, x+B.w/2, y+B.h*0.45, pulse*0.55, auraCol, 0.28);
    // Floating embers / sparks around boss in phase 2
    ctx.globalAlpha=0.7;
    for(let i=0;i<6;i++){
      const angle=G.frame*0.05+i*(Math.PI*2/6);
      const r=38+Math.sin(G.frame*0.12+i)*14;
      const ex=x+B.w/2+Math.cos(angle)*r;
      const ey=y+B.h*0.4+Math.sin(angle)*r*0.5;
      const es=2+Math.sin(G.frame*0.18+i)*1.5;
      circ(ctx,ex,ey,es,auraCol);
    }
    ctx.globalAlpha=1;
  }

  // Draw the boss
  fn(ctx,x,y,s,B);

  // Attack state: weapon impact flash ring
  if(s==='attack'){
    ctx.globalAlpha=0.12+Math.sin(G.frame*0.4)*0.08;
    ctx.fillStyle=auraCol;
    ctx.fillRect(x-10,y-10,B.w+20,B.h+20);
    ctx.globalAlpha=1;
  }
}

function drawParticle(ctx,p){
  ctx.globalAlpha=p.alpha;
  px(ctx,p.x,p.y,p.size,p.size,p.color);
  ctx.globalAlpha=1;
}

function drawProjectile(ctx,proj){
  const color=proj.color||(proj.from==='boss'?'#ff4444':'#4488ff');
  ctx.globalAlpha=0.85;
  // Glow halo
  const g=ctx.createRadialGradient(proj.x,proj.y,0,proj.x,proj.y,proj.size*1.6);
  g.addColorStop(0,color);g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(proj.x-proj.size*1.6,proj.y-proj.size*1.6,proj.size*3.2,proj.size*3.2);
  // Core
  ctx.globalAlpha=1;
  ctx.fillStyle=color;
  circ(ctx,proj.x,proj.y,proj.size/2,color);
  ctx.fillStyle='#ffffff'; ctx.globalAlpha=0.6;
  circ(ctx,proj.x-proj.size*0.15,proj.y-proj.size*0.15,proj.size*0.25,'#ffffff');
  ctx.globalAlpha=1;
}

// ============================================================
// IN-GAME NOTIFICATION (replaces alert popups)
// ============================================================
let _notifTimeout=null;
function showNotification(text,duration=2800){
  const el=document.getElementById('game-notification');
  const tx=document.getElementById('notif-text');
  if(!el||!tx) return;
  tx.textContent=text;
  el.style.opacity='1';
  if(_notifTimeout) clearTimeout(_notifTimeout);
  _notifTimeout=setTimeout(()=>{ el.style.opacity='0'; },duration);
}

// ============================================================
// FLOATING DAMAGE NUMBERS
// ============================================================
let _sfxVolume = 0.80;
function updateSfxVolume(val){
  _sfxVolume = val/100;
  const lbl = document.getElementById('sfx-vol-label');
  if(lbl) lbl.textContent = val+'%';
}

function spawnDamageNumber(x, y, value, type){
  const arena = document.getElementById('arena');
  if(!arena) return;
  const rect = arena.getBoundingClientRect();
  const div = document.createElement('div');
  div.className = 'dmg-float' + (type?' '+type:'');
  const prefix = type==='heal'?'+':type==='boss'?'-':'';
  div.textContent = prefix + Math.round(value);
  div.style.left = (x - rect.left - 20) + 'px';
  div.style.top  = (y - rect.top  - 30) + 'px';
  arena.appendChild(div);
  setTimeout(()=>div.remove(), 950);
}

// ============================================================
// BOSS PREVIEW TOOLTIP
// ============================================================
const BOSS_MAX_HP    = Math.max(...BOSSES.map(b=>b.hp));
const BOSS_MAX_ATK   = Math.max(...BOSSES.map(b=>b.atk));
const BOSS_MAX_SOULS = Math.max(...BOSSES.map(b=>b.souls));

function showBossPreview(boss, el){
  const tip = document.getElementById('boss-preview-tip');
  if(!tip) return;
  document.getElementById('bpt-name').textContent = boss.name;
  document.getElementById('bpt-hp').style.width    = (boss.hp/BOSS_MAX_HP*100)+'%';
  document.getElementById('bpt-atk').style.width   = (boss.atk/BOSS_MAX_ATK*100)+'%';
  document.getElementById('bpt-souls').style.width = (boss.souls/BOSS_MAX_SOULS*100)+'%';
  const rect = el.getBoundingClientRect();
  tip.style.left = (rect.right + 10) + 'px';
  tip.style.top  = rect.top + 'px';
  tip.classList.add('visible');
}

function hideBossPreview(){
  const tip = document.getElementById('boss-preview-tip');
  if(tip) tip.classList.remove('visible');
}

// ============================================================
// COPY RESULT TO CLIPBOARD
// ============================================================
function copyResultToClipboard(){
  const reward = document.getElementById('victory-reward');
  const text = reward ? reward.textContent.trim() : 'DARK PIXELS — VICTORY';
  const share = `🔥 DARK PIXELS — 8-BIT SOULS\n${text}\n\nCan you do better?`;
  navigator.clipboard.writeText(share).then(()=>{
    showNotification('📋 Result copied to clipboard!', 2000);
  }).catch(()=>{
    prompt('Copy this result:', share);
  });
}

// ============================================================
// TUTORIAL SYSTEM
// ============================================================
let tutorialActive=false, tutorialStep=0, tutorialTimer=0;
const TUTORIAL_STEPS=[
  {text:'USE  A / D  TO  MOVE  LEFT  AND  RIGHT',        hint:'Move toward the boss to close the distance',    duration:240, trigger:'start'},
  {text:'PRESS  W  TO  JUMP  OVER  ATTACKS',             hint:'Jump over low sweeps and obstacles',             duration:220, trigger:'auto'},
  {text:'PRESS  J  TO  ATTACK  the  boss',               hint:'Get close first — melee range only',             duration:220, trigger:'auto'},
  {text:'PRESS  SPACE  TO  ROLL  AND  DODGE',            hint:'Roll through boss attacks to avoid damage',      duration:220, trigger:'auto'},
  {text:'PRESS  F  TO  BLOCK  INCOMING  HITS',           hint:'Hold F — the GUARD bar absorbs damage',          duration:240, trigger:'auto'},
  {text:'PRESS  E  TO  DRINK  ESTUS  FLASK',             hint:'Heals HP — limited charges, use wisely',         duration:220, trigger:'auto'},
  {text:'PRESS  K  TO  CAST  MAGIC  (needs MP)',         hint:'Ranged attack — great for staying safe',         duration:220, trigger:'auto'},
  {text:'WHEN  BOSS  GLOWS  RED  —  COMBO  INCOMING!',  hint:'Roll with SPACE to dodge through the combo chain',duration:260, trigger:'auto'},
  {text:'DEFEAT  THE  BOSS  TO  EARN  SOULS',            hint:'Use souls at the Firelink Shrine to upgrade',    duration:220, trigger:'auto'},
  {text:'GOOD  LUCK,  UNKINDLED',                        hint:'May the flames guide thee',                      duration:180, trigger:'auto'},
];

function startTutorial(){
  tutorialActive=true;
  tutorialStep=0;
  tutorialTimer=0;
  showTutorialStep(0);
}

function showTutorialStep(i){
  if(i>=TUTORIAL_STEPS.length){ endTutorial(); return; }
  const step=TUTORIAL_STEPS[i];
  const el=document.getElementById('tutorial-subtitle');
  const txt=document.getElementById('tutorial-text');
  const hint=document.getElementById('tutorial-hint');
  txt.textContent=step.text;
  hint.textContent=step.hint;
  el.classList.add('visible');
  tutorialTimer=step.duration;
}

function tickTutorial(){
  if(!tutorialActive) return;
  tutorialTimer--;
  if(tutorialTimer<=0){
    tutorialStep++;
    if(tutorialStep<TUTORIAL_STEPS.length){
      showTutorialStep(tutorialStep);
    } else {
      endTutorial();
    }
  }
}

function endTutorial(){
  tutorialActive=false;
  const el=document.getElementById('tutorial-subtitle');
  el.classList.remove('visible');
}

// ============================================================
// CONTROLS
// ============================================================
function pauseGame(){
  if(G.running){
    G.running=false;
    bossMusic.pause();
    const ov=document.getElementById('pause-overlay');
    ov.style.display='flex';
  }
}
function resumeGame(){
  const ov=document.getElementById('pause-overlay');
  ov.style.display='none';
  bossMusic.resume();
  G.running=true;
  G.lastTime=0;
  requestAnimationFrame(gameLoop);
}
function pauseGoToSelect(){
  const ov=document.getElementById('pause-overlay');
  ov.style.display='none';
  showScreen('screen-select');
}

let keys1={}, keys2={};
let _controlsSetup=false;
function setupControls(){
  if(_controlsSetup) return;
  _controlsSetup=true;

  const doP1Action=(e)=>{
    if(!G.running||!P||P.dead) return;
    const k=e.key.toLowerCase();
    const kb=keybinds1;
    keys1[k]=true;
    if(k===kb.left)  P.vx=-4.5*(P.speedMult||1);
    if(k===kb.right) P.vx=4.5*(P.speedMult||1);
    if(k===kb.jump&&(P.onGround||(P.coyoteFrames||0)>0)){ P.vy=-14.5; P.onGround=false; P.coyoteFrames=0; SFX.jump(); }
    if(k===kb.block&&P.guardCooldown===0&&P.guard>0){
      if(B&&B.state==='attack') tryParry(P);
      else P.blocking=true;
    }
    const freeStam=P.zeroStamTimer>0;
    if(k===kb.roll&&!P.rolling&&(freeStam||P.stamina>=25)){
      P.rolling=true; P.iframes=15+(P.phantomStepBonus||0);
      if(!freeStam) P.stamina-=25;
      const dir=(keys1[kb.left])?-1:(keys1[kb.right])?1:1;
      P.vx=dir*10*(P.speedMult||1);
      SFX.roll();
    }
    if(k===kb.attack&&!P.attacking&&(freeStam||P.stamina>=15)){
      if(P.parryWindow>0) tryParry(P);
      else { P.attacking=true; if(!freeStam) P.stamina-=15; SFX.swing(); }
    }
    if(k===kb.magic&&!P.casting&&P.mp>=25){
      P.casting=true; P.mp-=25; flash('magic');
      SFX.magic();
      const angle=Math.atan2(B.y-P.y,B.x-P.x);
      const magicBonus=1+(upgrades.wandPow||0)*0.08+(upgrades.magic||0)*0.08+(P.armor&&P.armor.key==='sorcerer'?0.30:0);
      projectiles.push({x:P.x+P.w/2,y:P.y+P.h/2,vx:Math.cos(angle)*8,vy:Math.sin(angle)*8,dmg:P.atk*0.6*magicBonus,from:'player',size:10});
    }
    if(k===kb.heal&&P.estus>0){
      P.estus--;
      const healAmt=rebirthAbilities.includes('cursed_vigor')?P.maxHp*0.25:P.maxHp*0.35;
      P.hp=Math.min(P.maxHp,P.hp+healAmt);
      spawnParticles(P.x+P.w/2,P.y+P.h/2,10,'#e8a820');
      SFX.heal();
      const arena=document.getElementById('arena');
      if(arena){ const r=arena.getBoundingClientRect(); spawnDamageNumber(P.x+P.w/2+r.left,P.y+r.top,Math.floor(healAmt),'heal'); }
    }
  }

  const doP2Action=(e)=>{
    if(!G.running||!P2||P2.dead||gameMode!=='2p') return;
    const k=e.key.toLowerCase();
    const kb=keybinds2;
    keys2[k]=true;
    if(k===kb.left)  P2.vx=-4.5*(P2.speedMult||1);
    if(k===kb.right) P2.vx=4.5*(P2.speedMult||1);
    if(k===kb.jump&&(P2.onGround||(P2.coyoteFrames||0)>0)){ P2.vy=-14.5; P2.onGround=false; P2.coyoteFrames=0; }
    if(k===kb.block&&P2.guardCooldown===0&&P2.guard>0){
      if(B&&B.state==='attack') tryParry(P2);
      else P2.blocking=true;
    }
    const freeStam2=P2.zeroStamTimer>0;
    if(k===kb.roll&&!P2.rolling&&(freeStam2||P2.stamina>=25)){
      P2.rolling=true; P2.iframes=15+(P2.phantomStepBonus||0);
      if(!freeStam2) P2.stamina-=25;
      const dir2=(keys2[kb.left])?-1:(keys2[kb.right])?1:1;
      P2.vx=dir2*10*(P2.speedMult||1);
    }
    if(k===kb.attack&&!P2.attacking&&(freeStam2||P2.stamina>=15)){ P2.attacking=true; if(!freeStam2) P2.stamina-=15; }
    if(k===kb.magic&&!P2.casting&&P2.mp>=25){
      P2.casting=true; P2.mp-=25; flash('magic');
      const angle2=Math.atan2(B.y-P2.y,B.x-P2.x);
      const mb2=1+(upgrades.wandPow||0)*0.08+(upgrades.magic||0)*0.08+(P2.armor&&P2.armor.key==='sorcerer'?0.30:0);
      projectiles.push({x:P2.x+P2.w/2,y:P2.y+P2.h/2,vx:Math.cos(angle2)*8,vy:Math.sin(angle2)*8,dmg:P2.atk*0.6*mb2,from:'player',size:10});
    }
    if(k===kb.heal&&P2.estus>0){
      P2.estus--;
      const heal2=rebirthAbilities.includes('cursed_vigor')?P2.maxHp*0.25:P2.maxHp*0.35;
      P2.hp=Math.min(P2.maxHp,P2.hp+heal2);
      spawnParticles(P2.x+P2.w/2,P2.y+P2.h/2,10,'#e8a820');
    }
  }

  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&G.running){ e.preventDefault(); pauseGame(); return; }
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    doP1Action(e);
    doP2Action(e);
  });

  window.addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    keys1[k]=false;
    keys2[k]=false;
    if(P&&!P.dead){
      if(k===keybinds1.left&&!keys1[keybinds1.right]) P.vx=0;
      if(k===keybinds1.right&&!keys1[keybinds1.left]) P.vx=0;
      if(k===keybinds1.block) P.blocking=false;
    }
    if(P2&&!P2.dead&&gameMode==='2p'){
      if(k===keybinds2.left&&!keys2[keybinds2.right]) P2.vx=0;
      if(k===keybinds2.right&&!keys2[keybinds2.left]) P2.vx=0;
      if(k===keybinds2.block) P2.blocking=false;
    }
  });

  // Continuous movement on keydown held
  window.addEventListener('keydown',e=>{
    if(!G.running) return;
    const k=e.key.toLowerCase();
    if(P&&!P.dead){
      if(k===keybinds1.left)  P.vx=-4.5*(P.speedMult||1);
      if(k===keybinds1.right) P.vx=4.5*(P.speedMult||1);
    }
    if(P2&&!P2.dead&&gameMode==='2p'){
      if(k===keybinds2.left)  P2.vx=-4.5*(P2.speedMult||1);
      if(k===keybinds2.right) P2.vx=4.5*(P2.speedMult||1);
    }
  });
}

function doAutoPlay(){
  if(!P||!B||!G.running||P.dead) return;
  const dx=B.x-P.x;
  const dist=Math.abs(dx);
  if(P.hp<P.maxHp*0.3&&P.estus>0&&G.frame%60===0){
    P.estus--; P.hp=Math.min(P.maxHp,P.hp+P.maxHp*0.5);
    spawnParticles(P.x+P.w/2,P.y+P.h/2,10,'#e8a820');
  }
  if(dist<150&&P.stamina>=10&&G.frame%20===0){ P.attacking=true; P.stamina-=10; }
  if(dist>200&&dist<400&&P.mp>=20&&G.frame%40===0){
    P.casting=true; P.mp-=20; flash('magic');
    const angle=Math.atan2(B.y-P.y,dx);
    projectiles.push({x:P.x+P.w/2,y:P.y+P.h/2,vx:Math.cos(angle)*8,vy:Math.sin(angle)*8,dmg:P.atk*0.8,from:'player',size:10});
  }
  if(dist>180) P.vx=Math.sign(dx)*3;
  else if(dist<100) P.vx=Math.sign(dx)*-4;
  if(B.state==='attack'&&dist<200&&P.stamina>=20&&G.frame%40===0){
    P.rolling=true; P.iframes=20; P.stamina-=20; P.vx=Math.sign(dx)*-10;
  }
}

// ============================================================
// POST-BATTLE
// ============================================================
function retryBoss(){
  startBossFight();
}

function showBonfire(){
  showScreen('screen-select');
}

function afterVictory(){
  const allDefeated=BOSSES.every(b=>defeatedBosses.includes(b.id));
  if(allDefeated){
    if(rebirthCount>=MAX_REBIRTHS){
      showScreen('screen-select');
      setTimeout(()=>showNotification('🏆 ALL 5 REBIRTHS COMPLETE — only endless challenge awaits.',4000),200);
    } else {
      showRebirthScreen();
    }
  }else{
    showScreen('screen-select');
  }
}

// ============================================================
// REBIRTH SYSTEM — max 5 rebirths, 3 unique choices each
// ============================================================
const MAX_REBIRTHS = 5;

const REBIRTH_ABILITIES = [
  { key:'soul_harvest',   icon:'💀', name:'SOUL HARVEST',      desc:'Soul gains increased by 50%. The dark gifts what was lost.' },
  { key:'ancient_shield', icon:'🛡', name:'ANCIENT RESILIENCE', desc:'Start each fight with a phantom barrier absorbing the first hit.' },
  { key:'dark_flame',     icon:'🔥', name:'DARK FLAME',         desc:'15% chance on any attack to deal +10 bonus fire damage.' },
  { key:'undying_will',   icon:'💫', name:'UNDYING WILL',       desc:'Revive once per fight with 20% HP. Death is not the end.' },
  { key:'cursed_vigor',   icon:'❤', name:'CURSED VIGOR',       desc:'+100 max HP permanently, but estus heals 30% less.' },
  { key:'phantom_step',   icon:'👻', name:'PHANTOM STEP',       desc:'Roll grants 25 extra iframes. The abyss cannot catch you.' },
  { key:'ember_edge',     icon:'🗡', name:'EMBER EDGE',         desc:'First attack of each fight deals triple damage.' },
  { key:'hollow_sight',   icon:'👁', name:'HOLLOW SIGHT',       desc:'See boss phase 2 threshold. +10% damage when boss is enraged.' },
  { key:'abyssal_core',   icon:'🌑', name:'ABYSSAL CORE',       desc:'MP regenerates 2× faster. The dark flows through thee.' },
  { key:'iron_will',      icon:'⚙', name:'IRON WILL',          desc:'Take 25% less damage. Forged by countless deaths.' },
  { key:'soulbond',       icon:'🔗', name:'SOULBOND',           desc:'Killing blows restore 15% HP. Feed on their essence.' },
  { key:'cursed_blade',   icon:'💜', name:'CURSED BLADE',       desc:'Each attack stacks a curse — 5 stacks burst for 50 bonus dmg.' },
  { key:'bone_dust',      icon:'🦴', name:'BONE DUST',          desc:'+2 Estus charges permanently. Carry more of the sacred fire.' },
  { key:'age_of_dark',    icon:'🌑', name:'AGE OF DARK',        desc:'All damage increased by 20% but max HP reduced by 50.' },
  { key:'artorias_vow',   icon:'⚔', name:'ARTORIAS\'S VOW',    desc:'Stamina costs 0 for the first 10 seconds of each fight.' },
];

function showRebirthScreen(){
  if(rebirthCount>=MAX_REBIRTHS){ showScreen('screen-select'); return; }
  rebirthCount++;
  defeatedBosses=[];
  showScreen('screen-rebirth');
  document.getElementById('rebirth-count-display').textContent=`REBIRTH ${'I'.repeat(rebirthCount)} / ${'I'.repeat(MAX_REBIRTHS)}`;
  document.getElementById('rebirth-sub').textContent=`Choose your dark gift. ${MAX_REBIRTHS-rebirthCount} rebirths remain after this.`;

  const list=document.getElementById('rebirth-ability-list'); list.innerHTML='';
  // Show only abilities not yet obtained, pick 3 random ones
  const available=REBIRTH_ABILITIES.filter(a=>!rebirthAbilities.includes(a.key));
  // Shuffle available and pick 3
  const shuffled=[...available].sort(()=>Math.random()-.5);
  const opts=shuffled.slice(0,3);
  // If fewer than 3 available (all obtained), show 3 random from all
  while(opts.length<3){
    const extra=REBIRTH_ABILITIES[Math.floor(Math.random()*REBIRTH_ABILITIES.length)];
    if(!opts.find(o=>o.key===extra.key)) opts.push(extra);
  }

  opts.forEach(ab=>{
    const div=document.createElement('div');
    div.style.cssText='padding:14px 18px;border:2px solid #440088;background:#0a0015;cursor:pointer;transition:all .1s;display:flex;gap:12px;align-items:center;';
    div.innerHTML=`<span style="font-size:28px;">${ab.icon}</span><div><div style="font-size:clamp(6px,.95vw,9px);color:#cc88ff;margin-bottom:5px;letter-spacing:2px;">${ab.name}</div><div style="font-size:clamp(4px,.65vw,6px);color:#886699;line-height:1.8;">${ab.desc}</div></div>`;
    div.onmouseenter=()=>{div.style.borderColor='#cc44ff';div.style.background='#110025';};
    div.onmouseleave=()=>{div.style.borderColor='#440088';div.style.background='#0a0015';};
    div.onclick=()=>chooseRebirthAbility(ab.key);
    list.appendChild(div);
  });
  document.getElementById('rebirth-souls-display').textContent=totalSouls.toLocaleString();
}

function chooseRebirthAbility(key){
  if(!rebirthAbilities.includes(key)) rebirthAbilities.push(key);
  buildBossList();
  document.getElementById('select-souls').textContent=totalSouls.toLocaleString();
  const ab=REBIRTH_ABILITIES.find(a=>a.key===key);
  const remaining=MAX_REBIRTHS-rebirthCount;
  showScreen('screen-select');
  saveGame();
  setTimeout(()=>{
    if(ab) showNotification(`✨ ${ab.name} — ${ab.desc}  |  ${remaining>0?`${remaining} rebirth${remaining>1?'s':''} remaining`:'FINAL rebirth — the cycle ends here'}`,4500);
  },100);
}

// Apply rebirth abilities to player at fight start
function applyRebirthToPlayer(p){
  if(rebirthAbilities.includes('ancient_shield')) p.phantomBarrier=true;
  if(rebirthAbilities.includes('cursed_vigor')){ p.hp+=100; p.maxHp+=100; }
  if(rebirthAbilities.includes('bone_dust')){ p.estus+=2; p.maxEstus+=2; }
  if(rebirthAbilities.includes('iron_will')) p.defense=(p.defense||0)+Math.floor(p.maxHp*0.25*0.01);
  if(rebirthAbilities.includes('age_of_dark')){ p.hp=Math.max(1,p.hp-50); p.maxHp=Math.max(50,p.maxHp-50); }
  if(rebirthAbilities.includes('artorias_vow')) p.zeroStamTimer=600; // 10 sec at 60fps
  p.curseStacks=0;
  p.emberEdgeUsed=false;
  p.undyingUsed=false;
  p.soulbondActive=rebirthAbilities.includes('soulbond');
  p.phantomStepBonus=rebirthAbilities.includes('phantom_step')?25:0;
  p.abyssalCore=rebirthAbilities.includes('abyssal_core');
  p.hollowSight=rebirthAbilities.includes('hollow_sight');
  p.cursedBlade=rebirthAbilities.includes('cursed_blade');
  p.emberEdge=rebirthAbilities.includes('ember_edge');
}

// ============================================================
// BOSS DRAW FUNCTIONS — redesigned v16/v17
// ============================================================
function bossGlow(ctx,cx,cy,r,col,alpha){
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
  g.addColorStop(0,col);g.addColorStop(1,'transparent');
  ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(cx-r,cy-r,r*2,r*2);ctx.globalAlpha=1;
}

// Filled circle helper
function circ(ctx,cx,cy,r,col){
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();
}

// Glowing eye — outer halo + iris + pupil + catchlight
function glowEye(ctx,cx,cy,r,col){
  // Outer glow halo
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*3);
  g.addColorStop(0,col);g.addColorStop(0.4,col+'99');g.addColorStop(1,'transparent');
  ctx.globalAlpha=0.55;ctx.fillStyle=g;
  ctx.fillRect(cx-r*3,cy-r*3,r*6,r*6);ctx.globalAlpha=1;
  // Sclera
  circ(ctx,cx,cy,r,'#e8e0d0');
  // Iris
  circ(ctx,cx,cy,r*0.65,col);
  // Pupil
  circ(ctx,cx,cy,r*0.3,'#000000');
  // Catchlight
  ctx.globalAlpha=0.85;circ(ctx,cx-r*0.22,cy-r*0.22,r*0.2,'#ffffff');ctx.globalAlpha=1;
}

// Ground shadow ellipse under boss
function bossShadow(ctx,cx,by,rw,rh){
  const g=ctx.createRadialGradient(cx,by,0,cx,by,rw);
  g.addColorStop(0,'rgba(0,0,0,0.55)');g.addColorStop(1,'transparent');
  ctx.globalAlpha=0.7;ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(cx,by,rw,rh,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;
}

// Weapon glow trail — smear of glowing color along weapon during attack
function weapGlow(ctx,x,y,w,h,col,alpha){
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'transparent');g.addColorStop(0.5,col);g.addColorStop(1,'transparent');
  ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;
}

// Animated flame tips helper — draws flickering fire particles along top edge
function flameTips(ctx,x,y,w,col,frame){
  ctx.globalAlpha=0.7;
  const flicker=0.5+Math.sin(frame*0.22)*0.5;
  for(let i=0;i<Math.floor(w/8);i++){
    const fx=x+i*8;
    const fh=6+Math.sin(frame*0.18+i*0.9)*4+flicker*3;
    const fw=6+Math.sin(frame*0.14+i*1.3)*2;
    px(ctx,fx,y-fh,fw,fh,col);
    ctx.globalAlpha=0.35;
    px(ctx,fx-1,y-fh-3,fw+2,4,'#ffffff');
    ctx.globalAlpha=0.7;
  }
  ctx.globalAlpha=1;
}

function drawAsylumDemon(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const body=p2?'#b85530':'#7a3318', bodyHi=p2?'#dd7744':'#aa4422', bodyLo=p2?'#6a2808':'#4a1a08';
  const hornC='#3a1a08', eyeC=p2?'#ff8800':'#ffcc00', skinC=p2?'#cc6633':'#8a3a18';
  if(p2) bossGlow(ctx,x+38,y+40,70,'#ff4400',0.2);
  // Wide hunched shoulders
  px(ctx,x+2,y+18,76,16,bodyHi); px(ctx,x+0,y+22,80,8,body);
  // Head — broad gargoyle
  px(ctx,x+16,y+0,48,22,body);
  px(ctx,x+18,y+2,44,10,bodyHi); // highlight top
  px(ctx,x+16,y+18,48,4,bodyLo); // chin shadow
  // Curved horns
  px(ctx,x+12,y-10,8,14,hornC); px(ctx,x+10,y-12,6,4,hornC);
  px(ctx,x+60,y-10,8,14,hornC); px(ctx,x+64,y-12,6,4,hornC);
  // Eyes
  px(ctx,x+22,y+4,12,9,eyeC); px(ctx,x+46,y+4,12,9,eyeC);
  px(ctx,x+24,y+5,8,6,'#ffffff'); px(ctx,x+48,y+5,8,6,'#ffffff');
  px(ctx,x+26,y+6,4,4,'#000'); px(ctx,x+50,y+6,4,4,'#000');
  // Nostrils
  px(ctx,x+28,y+14,6,4,bodyLo); px(ctx,x+46,y+14,6,4,bodyLo);
  // Massive body
  px(ctx,x+8,y+26,64,36,body); px(ctx,x+12,y+28,56,14,bodyHi);
  px(ctx,x+8,y+56,64,6,bodyLo);
  // Gut details
  ctx.globalAlpha=0.35; px(ctx,x+20,y+34,40,20,bodyLo); ctx.globalAlpha=1;
  // Short stubby wings
  ctx.globalAlpha=0.7;
  px(ctx,x-8,y+14,14,32,bodyLo); px(ctx,x-10,y+12,10,8,body);
  px(ctx,x+74,y+14,14,32,bodyLo); px(ctx,x+80,y+12,10,8,body);
  ctx.globalAlpha=1;
  // Arms
  px(ctx,x+0,y+26,12,28,body); px(ctx,x+2,y+28,8,12,bodyHi);
  px(ctx,x+68,y+26,12,28,body); px(ctx,x+70,y+28,8,12,bodyHi);
  // Club / hammer
  if(state==='attack'){
    px(ctx,x+68,y-10,14,44,'#887766'); px(ctx,x+64,y-16,22,14,body);
    ctx.globalAlpha=0.5; px(ctx,x+62,y-14,26,46,'#ff6600'); ctx.globalAlpha=1;
  } else {
    px(ctx,x+70,y+8,12,36,'#887766'); px(ctx,x+66,y+6,18,10,body);
  }
  // Legs
  const lw=state==='walk'?Math.floor(Date.now()/90)%2*7:0;
  px(ctx,x+10,y+62,26,22,body); px(ctx,x+12,y+80,22,10,bodyLo);
  px(ctx,x+44,y+62+lw,26,22,body); px(ctx,x+46,y+80+lw,22,10,bodyLo);
  // Toe claws
  px(ctx,x+8,y+86,6,6,hornC); px(ctx,x+16,y+88,6,5,hornC); px(ctx,x+24,y+86,6,6,hornC);
  px(ctx,x+42,y+86+lw,6,6,hornC); px(ctx,x+50,y+88+lw,6,5,hornC);
  if(p2){ctx.globalAlpha=.22;px(ctx,x-4,y-4,88,96,'#ff4400');ctx.globalAlpha=1;}
}

function drawCapraDemon(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const body=p2?'#993322':'#661a00', hi=p2?'#cc5533':'#882211', lo=p2?'#551100':'#330800';
  const hornC='#221108', bladeC='#cccccc', bladeHi='#eeeeff';
  if(p2) bossGlow(ctx,x+28,y+35,55,'#ff3300',0.18);
  // Curved horns — goat-like
  px(ctx,x+6,y-12,8,18,hornC); px(ctx,x+4,y-14,10,6,hornC); px(ctx,x+2,y-10,6,8,hornC);
  px(ctx,x+38,y-12,8,18,hornC); px(ctx,x+40,y-14,10,6,hornC); px(ctx,x+46,y-10,6,8,hornC);
  // Head — wedge shaped muzzle
  px(ctx,x+10,y+0,36,18,body); px(ctx,x+12,y+2,32,8,hi);
  px(ctx,x+8,y+14,40,4,lo); // jaw shadow
  // Goat eyes (horizontal pupils)
  px(ctx,x+14,y+4,9,7,p2?'#ffcc00':'#cc8800');
  px(ctx,x+33,y+4,9,7,p2?'#ffcc00':'#cc8800');
  px(ctx,x+15,y+5,7,5,'#ffffaa'); px(ctx,x+34,y+5,7,5,'#ffffaa');
  px(ctx,x+17,y+6,3,3,'#000'); px(ctx,x+36,y+6,3,3,'#000'); // pupils
  // Snout
  px(ctx,x+18,y+14,20,6,lo); px(ctx,x+22,y+16,5,4,lo); px(ctx,x+31,y+16,5,4,lo);
  // Body — lean, muscular
  px(ctx,x+8,y+18,40,28,body); px(ctx,x+10,y+20,36,10,hi);
  px(ctx,x+8,y+42,40,4,lo);
  // Muscle definition
  ctx.globalAlpha=0.3; px(ctx,x+18,y+22,12,16,lo); px(ctx,x+28,y+22,12,16,lo); ctx.globalAlpha=1;
  // Arms
  px(ctx,x+0,y+20,10,24,body); px(ctx,x+2,y+22,6,10,hi);
  px(ctx,x+46,y+20,10,24,body); px(ctx,x+48,y+22,6,10,hi);
  // Dual machetes
  if(state==='attack'){
    px(ctx,x+52,y-8,5,50,bladeC); px(ctx,x+50,y-12,10,8,'#777');
    ctx.globalAlpha=0.5; px(ctx,x+54,y-6,2,46,bladeHi); ctx.globalAlpha=1;
    px(ctx,x-10,y-4,5,46,bladeC); px(ctx,x-14,y-8,12,8,'#777');
    ctx.globalAlpha=0.5; px(ctx,x-9,y-2,2,42,bladeHi); ctx.globalAlpha=1;
  } else {
    px(ctx,x+52,y+10,4,38,bladeC); px(ctx,x+49,y+8,10,6,'#777');
    px(ctx,x-6,y+12,4,34,bladeC); px(ctx,x-10,y+10,12,6,'#777');
  }
  // Legs — digitigrade
  const lw=state==='walk'?Math.floor(Date.now()/95)%2*6:0;
  px(ctx,x+10,y+46,16,24,body); px(ctx,x+12,y+66,12,10,lo);
  px(ctx,x+30,y+46+lw,16,24,body); px(ctx,x+32,y+66+lw,12,10,lo);
  // Hooves
  px(ctx,x+9,y+74,8,6,hornC); px(ctx,x+29,y+74+lw,8,6,hornC);
  if(p2){ctx.globalAlpha=.18;px(ctx,x-4,y-6,66,88,'#ff4400');ctx.globalAlpha=1;}
}

function drawSeath(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const sc=p2?'#aaccdd':'#6699aa', scHi=p2?'#cce8f0':'#88bbcc', scLo=p2?'#446677':'#334455';
  const crystC=p2?'#eeffff':'#88ddff', eyeC=p2?'#ff44aa':'#4488ff';
  if(p2) bossGlow(ctx,x+44,y+30,80,'#88ddff',0.2);
  // Huge serpentine tail — curves across the ground
  const wv=Math.floor(Date.now()/120)%2*4;
  px(ctx,x+60,y+38,22,22,sc); px(ctx,x+76,y+42+wv,18,18,scLo);
  px(ctx,x+88,y+48+wv,14,14,sc); px(ctx,x+98,y+52,10,10,scLo);
  // Main body — wide serpent
  px(ctx,x+10,y+16,78,32,sc); px(ctx,x+12,y+18,74,12,scHi);
  px(ctx,x+10,y+44,78,4,scLo);
  // Scale pattern on body
  ctx.globalAlpha=0.25;
  for(let i=0;i<6;i++) px(ctx,x+12+i*12,y+22,10,14,scLo);
  ctx.globalAlpha=1;
  // Wings — translucent membrane
  ctx.globalAlpha=0.55;
  px(ctx,x+2,y+0,18,36,scLo); px(ctx,x+0,y+0,6,28,'#335566');
  px(ctx,x+72,y+0,18,36,scLo); px(ctx,x+84,y+0,6,28,'#335566');
  // Wing bone spars
  for(let i=0;i<3;i++){ px(ctx,x+3+i*5,y+2+i*8,3,24-i*6,sc); px(ctx,x+75+i*5,y+2+i*8,3,24-i*6,sc); }
  ctx.globalAlpha=1;
  // Neck — long and curved
  px(ctx,x+10,y+4,24,18,sc); px(ctx,x+12,y+6,20,8,scHi);
  // Head — elongated dragon skull
  px(ctx,x-4,y-4,30,18,sc); px(ctx,x-2,y-2,26,8,scHi);
  px(ctx,x-8,y+2,14,10,sc); // long snout
  px(ctx,x-10,y+4,6,6,scHi);
  // Eyes — large glowing
  px(ctx,x-2,y+0,8,8,eyeC); px(ctx,x+10,y+0,8,8,eyeC);
  px(ctx,x-1,y+1,5,5,'#ffffff'); px(ctx,x+11,y+1,5,5,'#ffffff');
  // Crystal beard / whiskers
  ctx.globalAlpha=0.7;
  for(let i=0;i<4;i++) px(ctx,x-12-i*5,y+8+i*3,6,4,crystC);
  ctx.globalAlpha=1;
  // Crystal breath attack
  if(state==='attack'){
    ctx.globalAlpha=0.8;
    for(let i=0;i<7;i++) px(ctx,x-18-i*10,y+4+i*2,10,7,p2?'#ffffff':crystC);
    ctx.globalAlpha=1;
    // Crystal shards floating
    ctx.globalAlpha=0.5;
    for(let i=0;i<5;i++) px(ctx,x-8-i*14,y+0+i*4,6,10,crystC);
    ctx.globalAlpha=1;
  }
  // Crystal growths on body (phase 2)
  if(p2){ ctx.globalAlpha=0.55; for(let i=0;i<5;i++) px(ctx,x+14+i*13,y+10,6,14,crystC); ctx.globalAlpha=1; }
  if(p2){ctx.globalAlpha=.18;px(ctx,x-8,y-8,100,66,'#88ddff');ctx.globalAlpha=1;}
}

function drawFourKings(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#2a1155':'#140828', c2=p2?'#4a2288':'#281450', crown='#6600cc';
  if(p2) bossGlow(ctx,x+40,y+40,80,'#8800ff',0.25);
  const count=p2?4:2;
  for(let k=0;k<count;k++){
    const ox=(k%2)*16-(count>2?(k>1?-8:8):0);
    const oy=k*6-(count-1)*3;
    const al=p2?0.55+k*0.1:0.75+k*0.12;
    ctx.globalAlpha=Math.min(al,1);
    // Tall wraith crown
    for(let i=0;i<4;i++) px(ctx,x+ox+18+i*9,y+oy-8,5,12,crown);
    px(ctx,x+ox+14,y+oy-2,48,6,c2);
    // Head
    px(ctx,x+ox+16,y+oy+4,44,16,c1); px(ctx,x+ox+18,y+oy+6,40,6,c2);
    px(ctx,x+ox+20,y+oy+8,10,8,p2?'#ee00ff':'#9900ff'); px(ctx,x+ox+46,y+oy+8,10,8,p2?'#ee00ff':'#9900ff');
    // Robes
    px(ctx,x+ox+10,y+oy+20,56,36,c1); px(ctx,x+ox+12,y+oy+22,52,14,c2);
    // Flowing robe bottom — tapered
    px(ctx,x+ox+12,y+oy+54,52,8,c1); px(ctx,x+ox+16,y+oy+60,44,6,c2);
    px(ctx,x+ox+22,y+oy+66,32,6,c1);
    // Arms reaching out
    if(state==='attack'){
      px(ctx,x+ox+0,y+oy+22,14,10,c1); px(ctx,x+ox+62,y+oy+22,14,10,c1);
      ctx.globalAlpha*=0.7;
      for(let i=0;i<4;i++) px(ctx,x+ox+66+i*7,y+oy+20+i*5,8,6,p2?'#ff00ff':'#8800ff');
      for(let i=0;i<4;i++) px(ctx,x+ox-10-i*7,y+oy+20+i*5,8,6,p2?'#ff00ff':'#8800ff');
      ctx.globalAlpha=Math.min(al,1);
    } else {
      px(ctx,x+ox+2,y+oy+26,10,22,c2); px(ctx,x+ox+64,y+oy+26,10,22,c2);
    }
    ctx.globalAlpha=1;
  }
  if(p2){ctx.globalAlpha=.28;px(ctx,x-6,y-6,92,90,'#550099');ctx.globalAlpha=.1;px(ctx,x-12,y-12,104,104,'#ff00ff');ctx.globalAlpha=1;}
}

function drawNashandra(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const robe=p2?'#330044':'#220033', robeHi=p2?'#550066':'#3a0044', robeLo=p2?'#110022':'#0a0018';
  const eyeC=p2?'#ff22aa':'#9900cc', crownC='#660088', skinC='#553344';
  if(p2) bossGlow(ctx,x+35,y+35,65,'#cc0066',0.22);
  // 5-spike crown
  for(let i=0;i<5;i++){const h=8+(i===2?6:i===1||i===3?3:0); px(ctx,x+12+i*10,y-h,6,h+4,crownC);}
  px(ctx,x+8,y-2,50,4,p2?'#ff00aa':'#9900cc');
  // Head — elegant angular
  px(ctx,x+12,y+2,42,18,robe); px(ctx,x+14,y+4,38,8,robeHi);
  // Eyes — glowing dark
  px(ctx,x+16,y+6,12,9,eyeC); px(ctx,x+38,y+6,12,9,eyeC);
  px(ctx,x+18,y+7,8,6,'#ffffff'); px(ctx,x+40,y+7,8,6,'#ffffff');
  px(ctx,x+20,y+8,4,4,'#000'); px(ctx,x+42,y+8,4,4,'#000');
  // Thin neck
  px(ctx,x+22,y+20,22,6,skinC);
  // Flowing robes — widening at bottom
  px(ctx,x+8,y+26,50,30,robe); px(ctx,x+10,y+28,46,12,robeHi);
  ctx.globalAlpha=0.5; px(ctx,x+2,y+32,10,36,robeLo); px(ctx,x+54,y+32,10,36,robeLo);
  ctx.globalAlpha=1;
  px(ctx,x+10,y+54,46,12,robe); px(ctx,x+14,y+62,38,10,robeLo);
  // Dark soul fragments orbiting
  if(p2){
    const t=G.frame*0.06;
    ctx.globalAlpha=0.7;
    for(let i=0;i<4;i++){const a=t+i*Math.PI/2; px(ctx,x+36+Math.cos(a)*30,y+36+Math.sin(a)*18,6,6,eyeC);}
    ctx.globalAlpha=1;
  }
  // Scythe
  if(state==='attack'){
    px(ctx,x+56,y-8,5,62,'#aaaacc'); px(ctx,x+48,y-14,20,10,'#ccccee');
    ctx.globalAlpha=0.6; for(let i=0;i<5;i++) px(ctx,x+50+i*4,y-10+i*7,7,5,eyeC); ctx.globalAlpha=1;
  } else { px(ctx,x+56,y+8,4,48,'#9999bb'); px(ctx,x+48,y+4,20,10,'#aaaacc'); }
  // Slender arms
  px(ctx,x+2,y+28,10,20,skinC); px(ctx,x+54,y+28,10,20,skinC);
  const lw=state==='walk'?Math.floor(Date.now()/100)%2*5:0;
  px(ctx,x+14,y+72,16,18,robe); px(ctx,x+36,y+72+lw,16,18,robe);
  if(p2){ctx.globalAlpha=.22;px(ctx,x,y-4,66,84,'#880044');ctx.globalAlpha=1;}
}

function drawAldrich(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const slime=p2?'#2a0055':'#180030', slimeHi=p2?'#5500aa':'#330066', slimeLo=p2?'#0d0022':'#060010';
  const eyeC=p2?'#ff44ff':'#cc44ff', flesh='#331122';
  if(p2) bossGlow(ctx,x+40,y+45,80,'#8800ff',0.25);
  // Oozing slime base — amorphous
  const t=Math.floor(Date.now()/80)%3;
  for(let i=0;i<6;i++) px(ctx,x+4+i*12,y+66+(i+t)%3*5,10,18+(i+t)%3*4,slime);
  px(ctx,x+0,y+48,82,22,slimeLo);
  px(ctx,x+2,y+36,78,18,slime); px(ctx,x+6,y+38,70,8,slimeHi);
  // Torso of devoured god — melting
  px(ctx,x+18,y+14,46,26,slimeHi); px(ctx,x+20,y+16,42,10,p2?'#7700bb':'#441166');
  // Ribs visible through slime
  ctx.globalAlpha=0.35;
  for(let i=0;i<4;i++) px(ctx,x+22+i*8,y+22,5,14,flesh);
  ctx.globalAlpha=1;
  // Elongated bishop head emerging
  px(ctx,x+26,y-4,30,18,p2?'#440055':'#220033');
  px(ctx,x+28,y-2,26,8,slimeHi);
  // Eyes — multiple haunted
  px(ctx,x+30,y+0,8,8,eyeC); px(ctx,x+44,y+0,8,8,eyeC);
  px(ctx,x+32,y+1,5,5,'#ffffff'); px(ctx,x+46,y+1,5,5,'#ffffff');
  px(ctx,x+33,y+2,3,3,'#000'); px(ctx,x+47,y+2,3,3,'#000');
  if(p2){ px(ctx,x+24,y+4,6,6,eyeC); px(ctx,x+52,y+4,6,6,eyeC); }
  // Anor Londo arrow rain in attack
  if(state==='attack'){
    ctx.globalAlpha=0.85;
    const ct=p2?5:3;
    for(let i=0;i<ct;i++) px(ctx,x-14-i*14,y+8+i*8,10,5,p2?'#ff88ff':'#aa44ff');
    ctx.globalAlpha=1;
  }
  // Tentacles
  ctx.globalAlpha=0.6;
  px(ctx,x+4,y+24,10,20,slime); px(ctx,x+68,y+28,10,18,slime);
  ctx.globalAlpha=1;
  if(p2){ctx.globalAlpha=.22;px(ctx,x-2,y-4,86,86,'#660088');ctx.globalAlpha=1;}
}

function drawDancer(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const robe=p2?'#1e0a38':'#0e0520', robeHi=p2?'#3e1a60':'#1e0a40', robeLo=p2?'#0a0020':'#060010';
  const silk=p2?'#6600bb':'#330066', blade=p2?'#cc88ff':'#9944cc', eyeC=p2?'#ff22cc':'#8822aa';
  if(p2) bossGlow(ctx,x+36,y+40,65,'#cc00ff',0.22);
  // Veil / head-dress ornament
  ctx.globalAlpha=0.6;
  for(let i=0;i<5;i++) px(ctx,x+14+i*8,y-6,4,8,p2?'#9900ff':'#440088');
  ctx.globalAlpha=1;
  // Head — masked, elegant
  px(ctx,x+16,y+2,34,18,robe); px(ctx,x+18,y+4,30,8,robeHi);
  px(ctx,x+20,y+6,10,8,eyeC); px(ctx,x+36,y+6,10,8,eyeC);
  px(ctx,x+22,y+7,6,6,'#ffffff'); px(ctx,x+38,y+7,6,6,'#ffffff');
  px(ctx,x+23,y+8,4,4,'#000'); px(ctx,x+39,y+8,4,4,'#000');
  // Slender neck
  px(ctx,x+26,y+20,14,6,robe);
  // Body — lithe dancer
  ctx.globalAlpha=0.88;
  px(ctx,x+12,y+26,42,36,robe); px(ctx,x+14,y+28,38,14,robeHi);
  ctx.globalAlpha=1;
  // Flowing silk ribbons — animated
  const fl=Math.floor(Date.now()/70)%4;
  for(let i=0;i<4;i++){
    ctx.globalAlpha=0.45-i*0.06;
    px(ctx,x-6+i*2,y+30+i*10,7,18+fl*2,silk);
    px(ctx,x+65-i*2,y+30+i*10,7,18+fl*2,silk);
    ctx.globalAlpha=1;
  }
  // Twin curved blades
  if(state==='attack'){
    const sw=p2?Math.floor(Date.now()/55)%2*10:0;
    px(ctx,x+58,y-14+sw,5,58,blade); px(ctx,x+54,y-20+sw,14,10,robe);
    px(ctx,x-6,y+4-sw,5,52,blade); px(ctx,x-12,y+0-sw,14,10,robe);
    if(p2){ctx.globalAlpha=0.4; px(ctx,x+54,y-12+sw,12,10,eyeC); px(ctx,x-10,y+2-sw,12,10,eyeC); ctx.globalAlpha=1;}
  } else {
    px(ctx,x+58,y+10,4,46,p2?'#882288':'#551155');
    px(ctx,x-4,y+14,4,40,p2?'#882288':'#551155');
  }
  // Arms (barely visible)
  px(ctx,x+2,y+28,12,16,robe); px(ctx,x+52,y+28,12,16,robe);
  // Legs under robe
  const lw=state==='walk'?Math.floor(Date.now()/88)%2*5:0;
  px(ctx,x+16,y+62,14,20,robeLo); px(ctx,x+36,y+62+lw,14,20,robeLo);
  if(p2){ctx.globalAlpha=.2;px(ctx,x+4,y,64,82,'#cc00ff');ctx.globalAlpha=1;}
}

function drawSoulOfCinder(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const iron=p2?'#3a2a0a':'#1a1206', ironHi=p2?'#6a5020':'#2e1e0a', ironLo=p2?'#1a1004':'#0c0804';
  const fireC=p2?'#ffaa00':'#cc5500', eyeC=p2?'#ffffff':'#ffcc66', bladeC='#bbbbcc';
  if(p2) bossGlow(ctx,x+42,y+42,80,'#ff8800',0.28);
  // Flame crown — animated (phase 2 only)
  if(p2){
    flameTips(ctx,x+14,y+2,52,fireC,G.frame);
  }
  // Layered composite armor — overlapping plates
  px(ctx,x+12,y+8,56,20,iron); px(ctx,x+14,y+10,52,10,ironHi);
  // Head — grim full helm
  px(ctx,x+16,y-2,48,14,iron); px(ctx,x+18,y+0,44,6,ironHi);
  px(ctx,x+16,y-6,48,6,ironLo); // top cap
  // Visor slit (glowing)
  px(ctx,x+20,y+4,12,6,eyeC); px(ctx,x+48,y+4,12,6,eyeC);
  // Chest — multiple overlapping plates show composite origin
  px(ctx,x+10,y+28,60,32,iron); px(ctx,x+12,y+30,56,12,ironHi);
  ctx.globalAlpha=0.35; px(ctx,x+14,y+36,52,18,ironLo); ctx.globalAlpha=1;
  // Armor seams/layering detail
  ctx.globalAlpha=0.5;
  px(ctx,x+10,y+42,60,2,ironLo); px(ctx,x+10,y+50,60,2,ironLo);
  ctx.globalAlpha=1;
  // Cape fragments
  ctx.globalAlpha=0.45;
  for(let i=0;i<4;i++) px(ctx,x+2,y+32+i*8,8,6,ironLo);
  ctx.globalAlpha=1;
  // Arms — full plate
  px(ctx,x+0,y+28,14,26,iron); px(ctx,x+2,y+30,8,12,ironHi);
  px(ctx,x+66,y+28,14,26,iron); px(ctx,x+68,y+30,8,12,ironHi);
  // Greatsword with fire
  if(state==='attack'){
    px(ctx,x+64,y-24,10,82,bladeC); px(ctx,x+60,y-28,18,12,iron);
    ctx.globalAlpha=p2?0.85:0.55;
    for(let i=0;i<(p2?10:6);i++) px(ctx,x+58+Math.sin(i*0.8)*8,y-22+i*9,7,7,i%2?fireC:'#ffcc00');
    ctx.globalAlpha=1;
  } else {
    px(ctx,x+64,y+8,8,62,bladeC); px(ctx,x+60,y+6,16,10,iron);
    ctx.globalAlpha=0.4; for(let i=0;i<4;i++) px(ctx,x+60,y+10+i*14,6,8,fireC); ctx.globalAlpha=1;
  }
  // Legs — greaves
  const lw=state==='walk'?Math.floor(Date.now()/100)%2*5:0;
  px(ctx,x+14,y+60,22,22,iron); px(ctx,x+14,y+80,22,10,ironLo);
  px(ctx,x+44,y+60+lw,22,22,iron); px(ctx,x+44,y+80+lw,22,10,ironLo);
  // Boot spurs
  px(ctx,x+10,y+88,8,4,ironHi); px(ctx,x+62,y+88+lw,8,4,ironHi);
  if(p2){ctx.globalAlpha=.25;px(ctx,x-2,y-4,84,96,'#ff8800');ctx.globalAlpha=.1;px(ctx,x-6,y-8,92,104,'#ffaa00');ctx.globalAlpha=1;}
}

function drawMidir(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const sc=p2?'#1a0e04':'#0e0804', scHi=p2?'#3a2010':'#1a1008', scLo=p2?'#0a0602':'#060402';
  const darkC=p2?'#8800cc':'#440066', eyeC=p2?'#ff2200':'#cc1100', underbC='#2a1808';
  if(p2) bossGlow(ctx,x+48,y+36,90,'#6600cc',0.22);
  // Long tail trailing right
  const wv=Math.floor(Date.now()/110)%2*5;
  px(ctx,x+76,y+28+wv,20,16,sc); px(ctx,x+92,y+32+wv,16,12,scHi);
  px(ctx,x+104,y+36,12,10,sc); px(ctx,x+114,y+40,8,8,scLo);
  // Belly/underside — lighter
  px(ctx,x+8,y+40,76,14,underbC);
  // Main dragon body — low and wide
  px(ctx,x+6,y+18,80,26,sc); px(ctx,x+8,y+20,76,10,scHi);
  // Scale texture
  ctx.globalAlpha=0.3;
  for(let i=0;i<7;i++) px(ctx,x+8+i*10,y+22,8,10,scLo);
  ctx.globalAlpha=1;
  // Wings — large dramatic spread
  ctx.globalAlpha=0.7;
  px(ctx,x+8,y-12,22,36,scLo); px(ctx,x+4,y-8,10,30,'#221108');
  // Wing membrane veins
  ctx.globalAlpha=0.35;
  for(let i=0;i<3;i++) px(ctx,x+10+i*6,y-8,3,28-i*6,scHi);
  ctx.globalAlpha=0.7;
  px(ctx,x+58,y-12,22,36,scLo); px(ctx,x+74,y-8,10,30,'#221108');
  ctx.globalAlpha=0.35;
  for(let i=0;i<3;i++) px(ctx,x+60+i*6,y-8,3,28-i*6,scHi);
  ctx.globalAlpha=1;
  // Neck curves up
  px(ctx,x+0,y+10,22,18,sc); px(ctx,x+2,y+12,18,8,scHi);
  // Head — huge wedge
  px(ctx,x-12,y+0,26,18,sc); px(ctx,x-10,y+2,22,8,scHi);
  // Snout
  px(ctx,x-18,y+6,12,10,sc); px(ctx,x-20,y+8,6,6,scHi);
  // Eyes — burning
  px(ctx,x-8,y+2,8,8,eyeC); px(ctx,x+4,y+2,8,8,eyeC);
  px(ctx,x-7,y+3,5,5,'#ff8800'); px(ctx,x+5,y+3,5,5,'#ff8800');
  // Dark flame breath
  if(state==='attack'){
    ctx.globalAlpha=0.85;
    for(let i=0;i<8;i++) px(ctx,x-28-i*12,y+4+i*3,12,8,i%2?(p2?'#ff00ff':'#8800ff'):(p2?'#cc44ff':'#440088'));
    ctx.globalAlpha=1;
  }
  // Claws
  px(ctx,x+12,y+44,18,10,sc); px(ctx,x+56,y+44,18,10,sc);
  px(ctx,x+10,y+52,6,8,scLo); px(ctx,x+16,y+52,6,8,scLo); px(ctx,x+22,y+52,6,8,scLo);
  px(ctx,x+54,y+52,6,8,scLo); px(ctx,x+60,y+52,6,8,scLo); px(ctx,x+66,y+52,6,8,scLo);
  if(p2){ctx.globalAlpha=.22;px(ctx,x-14,y-10,110,80,'#440088');ctx.globalAlpha=.1;px(ctx,x-18,y-14,118,90,'#9900ff');ctx.globalAlpha=1;}
}

// ============================================================
// UNIQUE BOSS DRAW FUNCTIONS — redesigned v16
// ============================================================

function drawIudex(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const iron=p2?'#4a3a10':'#201806', ironHi=p2?'#7a6020':'#342808', ironLo=p2?'#1a1404':'#100c02';
  const eyeC=p2?'#ff4400':'#cc8800', spearC='#aaaaaa';
  if(p2) bossGlow(ctx,x+38,y+40,60,'#ff4400',0.2);
  // Hunched posture — spine forward
  // Pauldrons (wide shoulders)
  px(ctx,x+4,y+22,72,12,ironHi); px(ctx,x+6,y+24,68,6,iron);
  px(ctx,x+0,y+20,14,16,iron); px(ctx,x+66,y+20,14,16,iron);
  // Helm — flat-top jousting helm
  px(ctx,x+18,y+2,44,16,iron); px(ctx,x+20,y+4,40,6,ironHi);
  px(ctx,x+16,y+0,48,4,ironLo);
  // Visor slot
  px(ctx,x+22,y+8,14,7,eyeC); px(ctx,x+44,y+8,14,7,eyeC);
  px(ctx,x+22,y+8,14,7,'#000000',); // dark slot
  px(ctx,x+26,y+9,6,5,eyeC); px(ctx,x+48,y+9,6,5,eyeC);
  // Upper body — heavy plate
  px(ctx,x+12,y+34,56,30,iron); px(ctx,x+14,y+36,52,12,ironHi);
  // Chest crest detail
  ctx.globalAlpha=0.4; px(ctx,x+28,y+38,24,16,ironHi); ctx.globalAlpha=1;
  // Arms — gauntlets
  px(ctx,x+2,y+34,12,24,iron); px(ctx,x+4,y+36,8,10,ironHi);
  px(ctx,x+66,y+34,12,24,iron); px(ctx,x+68,y+36,8,10,ironHi);
  // Spear — long and tapered
  if(state==='attack'){
    px(ctx,x+62,y-22,6,70,spearC); px(ctx,x+58,y-26,14,8,iron);
    ctx.globalAlpha=0.4; px(ctx,x+64,y-20,2,66,'#ffffff'); ctx.globalAlpha=1;
    px(ctx,x+60,y-28,10,6,'#ccaa44'); // spear tip gold
  } else {
    px(ctx,x+58,y+4,5,60,spearC);
    px(ctx,x+56,y+2,8,6,'#ccaa44');
  }
  // Legs — heavy greaves
  const lw=state==='walk'?Math.floor(Date.now()/100)%2*5:0;
  px(ctx,x+14,y+64,24,20,iron); px(ctx,x+14,y+82,22,8,ironLo);
  px(ctx,x+42,y+64+lw,24,20,iron); px(ctx,x+42,y+82+lw,22,8,ironLo);
  px(ctx,x+12,y+88,12,4,ironHi); px(ctx,x+56,y+88+lw,12,4,ironHi);
  if(p2){ctx.globalAlpha=.2;px(ctx,x-2,y,84,92,'#ff4400');ctx.globalAlpha=1;}
}

function drawVordt(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const fur=p2?'#aaccdd':'#2a3a44', furHi=p2?'#cce4ee':'#445566', furLo=p2?'#5588aa':'#1a2830';
  const iceC=p2?'#ddf4ff':'#88bbcc', eyeC=p2?'#ffffff':'#88ccff';
  if(p2) bossGlow(ctx,x+40,y+38,75,'#88ddff',0.22);
  // Quadruped — beastly, low to ground
  // Haunches (back)
  px(ctx,x+52,y+22,32,26,fur); px(ctx,x+54,y+24,28,10,furHi);
  // Main body — hunched
  px(ctx,x+8,y+14,60,32,fur); px(ctx,x+10,y+16,56,14,furHi);
  // Neck — thick, bull-like
  px(ctx,x+6,y+8,24,16,fur); px(ctx,x+8,y+10,18,8,furHi);
  // Head — wide, low
  px(ctx,x+0,y+0,30,20,fur); px(ctx,x+2,y+2,26,8,furHi);
  // Ice-crusted muzzle
  px(ctx,x-2,y+10,14,8,iceC); px(ctx,x-4,y+12,8,6,furHi);
  // Teeth showing
  for(let i=0;i<4;i++) px(ctx,x-2+i*3,y+16,2,4,'#eeeeff');
  // Eyes
  px(ctx,x+4,y+2,8,8,eyeC); px(ctx,x+18,y+2,8,8,eyeC);
  px(ctx,x+5,y+3,6,5,'#ffffff'); px(ctx,x+19,y+3,6,5,'#ffffff');
  px(ctx,x+6,y+4,3,3,'#001133'); px(ctx,x+20,y+4,3,3,'#001133');
  // Ice growths on back
  if(p2){
    ctx.globalAlpha=0.65;
    for(let i=0;i<5;i++) px(ctx,x+12+i*10,y+8,6,12-(i%2)*4,iceC);
    ctx.globalAlpha=1;
  }
  // Ice mace
  if(state==='attack'){
    px(ctx,x-10,y+4,8,34,furLo); // handle
    px(ctx,x-14,y+0,16,12,iceC); // head
    ctx.globalAlpha=0.6; for(let i=0;i<4;i++) px(ctx,x-18-i*5,y+2+i*4,8,6,iceC); ctx.globalAlpha=1;
  } else {
    px(ctx,x-6,y+10,7,26,furLo);
    px(ctx,x-9,y+7,12,10,iceC);
  }
  // 4 chunky legs
  const lw=state==='walk'?Math.floor(Date.now()/120)%2*6:0;
  px(ctx,x+10,y+46,18,22,fur); px(ctx,x+10,y+66,16,8,furLo);
  px(ctx,x+30,y+46+lw,16,22,fur); px(ctx,x+30,y+66+lw,14,8,furLo);
  px(ctx,x+48,y+46,16,22,fur); px(ctx,x+48,y+66,14,8,furLo);
  px(ctx,x+66,y+46+lw,16,22,fur); px(ctx,x+66,y+66+lw,14,8,furLo);
  // Ice claw tips
  for(let i=0;i<3;i++){ px(ctx,x+9+i*4,y+72,3,5,iceC); px(ctx,x+47+i*4,y+72,3,5,iceC); }
  if(p2){ctx.globalAlpha=.2;px(ctx,x-4,y-4,92,80,'#aaeeff');ctx.globalAlpha=1;}
}

function drawGreatwood(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const bark=p2?'#4a6628':'#2e3e18', barkHi=p2?'#6a9034':'#4a6020', barkLo=p2?'#1e2e0e':'#141e08';
  const hollow=p2?'#ff2200':'#881100', sap='#3a5a18';
  if(p2) bossGlow(ctx,x+44,y+40,80,'#44aa00',0.18);
  // Root base (wide)
  px(ctx,x-6,y+78,96,14,barkLo); px(ctx,x-4,y+76,92,4,bark);
  // Main trunk — very wide, textured
  px(ctx,x+0,y+8,88,72,bark); px(ctx,x+2,y+10,84,28,barkHi);
  // Bark texture — vertical grain lines
  ctx.globalAlpha=0.25;
  for(let i=0;i<7;i++) px(ctx,x+4+i*12,y+12,6,60,barkLo);
  ctx.globalAlpha=1;
  // Bark rings / horizontal texture
  ctx.globalAlpha=0.2;
  for(let i=0;i<4;i++) px(ctx,x+2,y+20+i*14,84,6,barkLo);
  ctx.globalAlpha=1;
  // Hollow face — LEFT eye hollow
  px(ctx,x+10,y+16,20,16,hollow); px(ctx,x+12,y+18,16,12,'#330000');
  px(ctx,x+14,y+20,12,8,'#ff4400');
  // Hollow face — RIGHT eye hollow
  px(ctx,x+56,y+16,20,16,hollow); px(ctx,x+58,y+18,16,12,'#330000');
  px(ctx,x+60,y+20,12,8,'#ff4400');
  // Mouth hollow — screaming
  px(ctx,x+24,y+38,40,16,hollow); px(ctx,x+26,y+40,36,12,'#220000');
  // Teeth stumps in mouth
  for(let i=0;i<5;i++) px(ctx,x+26+i*7,y+38,5,5,'#ccaa88');
  for(let i=0;i<5;i++) px(ctx,x+26+i*7,y+50,5,4,'#ccaa88');
  // Branches — reaching during attack
  if(state==='attack'){
    px(ctx,x-18,y-4,20,56,bark); px(ctx,x-20,y-6,10,44,barkHi); px(ctx,x-22,y-8,8,8,barkLo);
    px(ctx,x+86,y-4,20,56,bark); px(ctx,x+88,y-6,10,44,barkHi); px(ctx,x+90,y-8,8,8,barkLo);
    // Branch tip leaves
    ctx.globalAlpha=0.7;
    for(let i=0;i<4;i++) px(ctx,x-26+i*4,y-10+i*6,8,6,barkHi);
    for(let i=0;i<4;i++) px(ctx,x+86+i*4,y-10+i*6,8,6,barkHi);
    ctx.globalAlpha=1;
  } else {
    px(ctx,x-10,y+6,12,44,bark); px(ctx,x+86,y+6,12,44,bark);
  }
  // Sap drip (phase 2)
  if(p2){
    ctx.globalAlpha=0.5;
    for(let i=0;i<3;i++) px(ctx,x+26+i*14,y+52,4,8+(i*3),sap);
    ctx.globalAlpha=1;
  }
  if(p2){ctx.globalAlpha=.15;px(ctx,x-4,y,96,92,'#44cc00');ctx.globalAlpha=1;}
}

function drawSif(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const fur=p2?'#cccccc':'#999999', furHi=p2?'#eeeeee':'#bbbbbb', furLo=p2?'#888888':'#555555';
  const eyeC=p2?'#ff2200':'#ffaa00', bladeC='#ccccee', bladeHi='#eeeeff';
  if(p2) bossGlow(ctx,x+40,y+36,65,'#aaaaff',0.15);
  // Fluffy tail — wagging
  const tt=Math.floor(Date.now()/90)%2*6;
  px(ctx,x+62,y+6+tt,22,14,furHi); px(ctx,x+76,y+10+tt,14,10,fur); px(ctx,x+86,y+14+tt,10,8,furLo);
  // Main wolf body
  px(ctx,x+12,y+18,58,32,fur); px(ctx,x+14,y+20,54,14,furHi);
  // Fur texture on back
  ctx.globalAlpha=0.2;
  for(let i=0;i<6;i++) px(ctx,x+14+i*9,y+18,6,8,furLo);
  ctx.globalAlpha=1;
  // Haunches
  px(ctx,x+52,y+24,22,26,fur); px(ctx,x+54,y+26,16,10,furHi);
  // Neck — powerful
  px(ctx,x+10,y+10,26,14,fur); px(ctx,x+12,y+12,22,6,furHi);
  // Head — wolf snout, proud
  px(ctx,x+0,y+2,34,22,fur); px(ctx,x+2,y+4,30,10,furHi);
  // Snout / muzzle
  px(ctx,x-4,y+12,18,8,furHi); px(ctx,x-6,y+14,10,6,fur);
  // Nose
  px(ctx,x-4,y+12,8,5,furLo);
  // Eyes
  px(ctx,x+8,y+4,9,8,eyeC); px(ctx,x+22,y+4,9,8,eyeC);
  px(ctx,x+9,y+5,7,6,'#ffffaa'); px(ctx,x+23,y+5,7,6,'#ffffaa');
  px(ctx,x+10,y+6,4,4,'#000'); px(ctx,x+24,y+6,4,4,'#000');
  // Ears — pointed
  px(ctx,x+12,y-6,8,10,fur); px(ctx,x+14,y-4,4,6,furHi);
  px(ctx,x+26,y-4,8,8,fur); px(ctx,x+28,y-2,4,5,furHi);
  // Giant greatsword in mouth
  if(state==='attack'){
    px(ctx,x-16,y-14,100,9,bladeC); px(ctx,x-20,y-18,24,12,fur);
    ctx.globalAlpha=0.55; px(ctx,x-14,y-12,96,4,bladeHi); ctx.globalAlpha=1;
    // Crossguard
    px(ctx,x+30,y-18,10,18,'#888899');
  } else {
    px(ctx,x-10,y-6,92,7,bladeC); px(ctx,x+28,y-10,8,14,'#888899');
    ctx.globalAlpha=0.4; px(ctx,x-8,y-4,88,3,bladeHi); ctx.globalAlpha=1;
  }
  // 4 legs
  const lw=state==='walk'?Math.floor(Date.now()/88)%2*6:0;
  px(ctx,x+12,y+50,16,22,fur); px(ctx,x+14,y+70,12,6,furLo);
  px(ctx,x+30,y+50+lw,14,22,fur); px(ctx,x+32,y+70+lw,10,6,furLo);
  px(ctx,x+48,y+50,14,22,fur); px(ctx,x+50,y+70,10,6,furLo);
  px(ctx,x+64,y+50+lw,14,22,fur); px(ctx,x+66,y+70+lw,10,6,furLo);
  // Paws
  px(ctx,x+10,y+74,10,5,furLo); px(ctx,x+46,y+74,10,5,furLo);
  if(p2){ctx.globalAlpha=.15;px(ctx,x-4,y-4,96,82,'#ddddff');ctx.globalAlpha=1;}
}

function drawStrayDemon(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const body=p2?'#cc5533':'#7a3318', bodyHi=p2?'#ee8855':'#aa4422', bodyLo=p2?'#6a2808':'#4a1a08';
  const wingC=p2?'#883322':'#551100', clubC='#776655';
  if(p2) bossGlow(ctx,x+40,y+38,72,'#ff5500',0.2);
  // Wide fat demon body
  // Body — very wide, bloated
  px(ctx,x+4,y+22,80,44,body); px(ctx,x+8,y+24,72,18,bodyHi);
  // Fat belly detail
  ctx.globalAlpha=0.3; px(ctx,x+16,y+38,56,22,bodyLo); ctx.globalAlpha=1;
  // Short thick neck
  px(ctx,x+26,y+8,36,16,body); px(ctx,x+28,y+10,32,8,bodyHi);
  // Demonic head — wide and low
  px(ctx,x+20,y+0,48,14,body); px(ctx,x+22,y+2,44,6,bodyHi);
  // Brow ridge
  px(ctx,x+18,y-2,52,4,bodyLo);
  // Eyes — high up, glowing
  px(ctx,x+24,y+2,12,9,p2?'#ffcc00':'#ff8800'); px(ctx,x+52,y+2,12,9,p2?'#ffcc00':'#ff8800');
  px(ctx,x+26,y+3,8,6,'#ffffff'); px(ctx,x+54,y+3,8,6,'#ffffff');
  // Horns — swept back
  px(ctx,x+18,y-8,6,10,'#330000'); px(ctx,x+16,y-10,8,4,'#330000');
  px(ctx,x+64,y-8,6,10,'#330000'); px(ctx,x+68,y-10,8,4,'#330000');
  // Tiny vestigial wings on back
  ctx.globalAlpha=0.6;
  px(ctx,x-4,y+16,12,28,wingC); px(ctx,x-6,y+14,8,8,body);
  px(ctx,x+80,y+16,12,28,wingC); px(ctx,x+82,y+14,8,8,body);
  ctx.globalAlpha=1;
  // Short thick arms
  px(ctx,x+0,y+26,10,22,body); px(ctx,x+2,y+28,6,10,bodyHi);
  px(ctx,x+78,y+26,10,22,body); px(ctx,x+80,y+28,6,10,bodyHi);
  // Club / hammer
  if(state==='attack'){
    px(ctx,x+78,y-4,16,44,clubC); px(ctx,x+74,y-10,24,14,body);
    ctx.globalAlpha=0.5; px(ctx,x+72,y-8,28,46,'#ff6600'); ctx.globalAlpha=1;
  } else {
    px(ctx,x+80,y+8,14,36,clubC); px(ctx,x+76,y+4,20,12,body);
  }
  // Stubby legs
  const lw=state==='walk'?Math.floor(Date.now()/110)%2*5:0;
  px(ctx,x+12,y+66,26,18,body); px(ctx,x+14,y+82,22,8,bodyLo);
  px(ctx,x+50,y+66+lw,26,18,body); px(ctx,x+52,y+82+lw,22,8,bodyLo);
  if(p2){ctx.globalAlpha=.2;px(ctx,x-2,y,92,90,'#ff5500');ctx.globalAlpha=1;}
}

function drawOrnstein(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  // Draw both Ornstein (left) and Smough (right)
  const oArmor=p2?'#cc9900':'#886600', oHi=p2?'#ffcc44':'#ccaa22', oLo=p2?'#665500':'#443300';
  const sArmor=p2?'#555566':'#333344', sHi=p2?'#7777aa':'#444466', sLo=p2?'#222233':'#111122';
  if(p2) bossGlow(ctx,x+44,y+36,90,'#ffcc00',0.22);
  // === ORNSTEIN (left, tall slim) ===
  // Tall ornate helm — lion crest
  px(ctx,x+10,y-8,22,6,oHi); px(ctx,x+8,y-4,26,4,oArmor); // crest
  px(ctx,x+10,y+0,22,18,oArmor); px(ctx,x+12,y+2,18,8,oHi);
  px(ctx,x+14,y+6,8,7,p2?'#ffee88':'#cc8800'); px(ctx,x+24,y+6,8,7,p2?'#ffee88':'#cc8800'); // eyes
  // Slim body
  px(ctx,x+8,y+18,26,30,oArmor); px(ctx,x+10,y+20,22,12,oHi);
  // Spear
  if(state==='attack'){
    px(ctx,x+36,y-18,4,62,p2?'#ffee88':'#ccccaa'); px(ctx,x+32,y-22,12,8,oArmor);
    ctx.globalAlpha=0.5; for(let i=0;i<4;i++) px(ctx,x+34,y-18+i*14,8,6,'#ffcc00'); ctx.globalAlpha=1;
  } else { px(ctx,x+36,y+4,4,50,'#aaaaaa'); px(ctx,x+32,y+2,10,6,oArmor); }
  px(ctx,x+4,y+20,8,22,oArmor); // left arm
  const lw1=state==='walk'?Math.floor(Date.now()/100)%2*5:0;
  px(ctx,x+10,y+48,12,20,oArmor); px(ctx,x+24,y+48+lw1,12,20,oArmor);
  px(ctx,x+10,y+66,10,6,oLo); px(ctx,x+24,y+66+lw1,10,6,oLo);
  // === SMOUGH (right, fat heavy) ===
  const ox=38;
  // Wide fat body
  px(ctx,x+ox+4,y+18,44,36,sArmor); px(ctx,x+ox+6,y+20,40,14,sHi);
  // Barrel helm
  px(ctx,x+ox+6,y+0,40,20,sArmor); px(ctx,x+ox+8,y+2,36,8,sHi);
  px(ctx,x+ox+6,y-4,40,6,sLo); // top cap
  px(ctx,x+ox+10,y+6,10,8,p2?'#cc44cc':'#446699'); px(ctx,x+ox+28,y+6,10,8,p2?'#cc44cc':'#446699'); // eyes
  // Executioner's hammer
  if(state==='attack'){
    px(ctx,x+ox+40,y-12,20,60,'#888877'); px(ctx,x+ox+36,y-18,28,14,sArmor);
    ctx.globalAlpha=0.5; px(ctx,x+ox+34,y-16,32,62,sHi); ctx.globalAlpha=1;
  } else {
    px(ctx,x+ox+42,y+4,18,52,'#778866'); px(ctx,x+ox+38,y+0,24,12,sArmor);
  }
  px(ctx,x+ox+0,y+20,8,24,sArmor); // left arm (short)
  const lw2=state==='walk'?Math.floor(Date.now()/110)%2*5:0;
  px(ctx,x+ox+6,y+54,18,20,sArmor); px(ctx,x+ox+28,y+54+lw2,18,20,sArmor);
  px(ctx,x+ox+4,y+72,18,8,sLo); px(ctx,x+ox+28,y+72+lw2,18,8,sLo);
  if(p2){ctx.globalAlpha=.18;px(ctx,x,y-6,88,96,'#ffbb00');ctx.globalAlpha=1;}
}

function drawArtorias(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const armor=p2?'#2a1544':'#160a28', armorHi=p2?'#4a2870':'#28143c', armorLo=p2?'#100828':'#080414';
  const abyss=p2?'#8800cc':'#440066', eyeC=p2?'#ff00ff':'#cc00ff', swordC='#8877aa';
  if(p2) bossGlow(ctx,x+38,y+38,70,'#8800cc',0.25);
  // Abyss corruption flowing from left arm
  if(p2){
    ctx.globalAlpha=0.45;
    for(let i=0;i<5;i++) px(ctx,x-8-i*6,y+16+i*6,8,10,abyss);
    ctx.globalAlpha=1;
  }
  // Cape billowing
  ctx.globalAlpha=0.5;
  px(ctx,x+4,y+22,12,46,armorLo); px(ctx,x+6,y+20,10,8,armor);
  ctx.globalAlpha=1;
  // Pauldrons — wide, asymmetric (left corrupted)
  px(ctx,x+2,y+16,24,12,p2?abyss:armorHi); // corrupted left
  px(ctx,x+52,y+16,22,12,armorHi);
  // Helm — wolf-ish, dramatic
  px(ctx,x+16,y+0,44,18,armor); px(ctx,x+18,y+2,40,8,armorHi);
  px(ctx,x+14,y-4,48,6,armorLo);
  // Eye slit — glowing
  px(ctx,x+20,y+6,14,7,eyeC); px(ctx,x+44,y+6,14,7,eyeC);
  // Body — plate armor
  px(ctx,x+10,y+28,56,32,armor); px(ctx,x+12,y+30,52,12,armorHi);
  // Abyss tendrils on body (phase 2)
  if(p2){ctx.globalAlpha=0.4; for(let i=0;i<4;i++) px(ctx,x+8+i*12,y+40,8,14,abyss); ctx.globalAlpha=1;}
  // Left arm — abyss corrupted
  px(ctx,x+0,y+28,12,28,p2?abyss:armor); px(ctx,x+2,y+30,8,12,p2?'#aa44cc':armorHi);
  // Right arm
  px(ctx,x+64,y+28,12,28,armor); px(ctx,x+66,y+30,8,12,armorHi);
  // Greatsword — massive, held one-handed
  if(state==='attack'){
    px(ctx,x+62,y-24,8,80,swordC); px(ctx,x+58,y-28,16,10,armor);
    ctx.globalAlpha=0.6; for(let i=0;i<6;i++) px(ctx,x+58,y-20+i*12,10,8,p2?abyss:'#9966cc'); ctx.globalAlpha=1;
  } else {
    px(ctx,x+62,y+4,7,62,swordC); px(ctx,x+58,y+2,14,8,armor);
    ctx.globalAlpha=0.3; px(ctx,x+60,y+6,6,58,p2?abyss:'#9966cc'); ctx.globalAlpha=1;
  }
  // Legs
  const lw=state==='walk'?Math.floor(Date.now()/98)%2*5:0;
  px(ctx,x+12,y+60,24,22,armor); px(ctx,x+14,y+80,22,8,armorLo);
  px(ctx,x+42,y+60+lw,24,22,armor); px(ctx,x+44,y+80+lw,22,8,armorLo);
  if(p2){ctx.globalAlpha=.22;px(ctx,x-2,y-2,80,92,'#6600aa');ctx.globalAlpha=1;}
}

function drawManus(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const body=p2?'#0a0018':'#060010', bodyHi=p2?'#1a0040':'#0e0028', bodyLo='#030008';
  const darkC=p2?'#9900ff':'#5500aa', eyeC=p2?'#ff00ff':'#cc22ff', skinC='#2a1020';
  if(p2) bossGlow(ctx,x+44,y+40,90,'#aa00ff',0.3);
  // Primeval dark aura
  ctx.globalAlpha=0.35;
  for(let i=0;i<6;i++){const a=G.frame*0.04+i*Math.PI/3; px(ctx,x+44+Math.cos(a)*38,y+40+Math.sin(a)*28,8,8,darkC);}
  ctx.globalAlpha=1;
  // Enormous twisted body
  px(ctx,x+4,y+20,80,44,body); px(ctx,x+8,y+22,72,18,bodyHi);
  px(ctx,x+4,y+60,80,4,bodyLo);
  // Body texture — dark mass
  ctx.globalAlpha=0.3; for(let i=0;i<6;i++) px(ctx,x+8+i*12,y+26,8,20,bodyLo); ctx.globalAlpha=1;
  // Massive head — ancient, skull-like
  px(ctx,x+20,y+0,48,24,body); px(ctx,x+22,y+2,44,10,bodyHi);
  // Primeval skull features
  px(ctx,x+14,y-4,60,6,bodyLo); // brow
  // Eyes — deeply glowing
  px(ctx,x+24,y+4,16,12,eyeC); px(ctx,x+48,y+4,16,12,eyeC);
  px(ctx,x+26,y+5,12,9,'#ffffff'); px(ctx,x+50,y+5,12,9,'#ffffff');
  px(ctx,x+28,y+6,8,7,'#000'); px(ctx,x+52,y+6,8,7,'#000');
  // Mouth — screaming, ancient
  px(ctx,x+28,y+16,32,6,bodyLo);
  for(let i=0;i<5;i++) px(ctx,x+30+i*6,y+14,4,4,skinC); // teeth
  // Huge grasping hands — main weapon
  if(state==='attack'){
    // Left hand smashing down
    px(ctx,x-12,y+10,20,32,skinC); px(ctx,x-10,y+12,16,14,body);
    for(let i=0;i<4;i++) px(ctx,x-14+i*4,y+40,6,10,skinC); // fingers
    // Right hand reaching
    px(ctx,x+80,y+4,20,28,skinC); px(ctx,x+82,y+6,16,12,body);
    for(let i=0;i<4;i++) px(ctx,x+82+i*4,y+30,6,10,skinC);
    // Dark magic
    ctx.globalAlpha=0.65;
    for(let i=0;i<5;i++) px(ctx,x-20-i*12,y+14+i*8,12,8,p2?'#ff00ff':'#8800ff');
    ctx.globalAlpha=1;
  } else {
    px(ctx,x-6,y+18,16,28,skinC); px(ctx,x+78,y+18,16,28,skinC);
    // Knuckles dragging
    for(let i=0;i<4;i++){ px(ctx,x-8+i*4,y+44,5,8,skinC); px(ctx,x+80+i*4,y+44,5,8,skinC); }
  }
  // Legs — massive stumps
  const lw=state==='walk'?Math.floor(Date.now()/130)%2*6:0;
  px(ctx,x+10,y+64,30,24,body); px(ctx,x+12,y+86,28,8,bodyLo);
  px(ctx,x+48,y+64+lw,30,24,body); px(ctx,x+50,y+86+lw,28,8,bodyLo);
  if(p2){ctx.globalAlpha=.28;px(ctx,x-6,y-4,100,100,'#5500aa');ctx.globalAlpha=.12;px(ctx,x-10,y-8,108,110,'#aa00ff');ctx.globalAlpha=1;}
}

function drawGwyn(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const gold=p2?'#ccaa00':'#886600', goldHi=p2?'#ffdd44':'#ccaa22', goldLo=p2?'#664400':'#442200';
  const eyeC=p2?'#ffffff':'#ffee99', bladeC='#ddccaa', hair='#cc8822';
  if(p2) bossGlow(ctx,x+40,y+40,75,'#ffaa00',0.25);
  // Flame hair / crown
  if(p2){flameTips(ctx,x+16,y+2,48,p2?'#ffcc00':'#ff8800',G.frame);}
  // Hair flowing — dignity of a fallen god
  ctx.globalAlpha=0.8;
  px(ctx,x+10,y+10,10,28,hair); px(ctx,x+58,y+10,10,28,hair);
  ctx.globalAlpha=1;
  // Regal crown / helm
  px(ctx,x+16,y-4,48,8,goldHi); px(ctx,x+18,y-6,44,4,gold);
  for(let i=0;i<5;i++) px(ctx,x+18+i*8,y-10,5,8,goldHi); // crown points
  // Face — noble, worn
  px(ctx,x+16,y+4,48,20,gold); px(ctx,x+18,y+6,44,8,goldHi);
  // Deep sad eyes
  px(ctx,x+20,y+8,12,9,eyeC); px(ctx,x+48,y+8,12,9,eyeC);
  px(ctx,x+22,y+9,8,6,'#ffffff'); px(ctx,x+50,y+9,8,6,'#ffffff');
  px(ctx,x+24,y+10,4,4,'#443300'); px(ctx,x+52,y+10,4,4,'#443300');
  // Beard
  ctx.globalAlpha=0.7;
  px(ctx,x+22,y+20,36,8,hair); px(ctx,x+26,y+26,28,6,goldLo);
  ctx.globalAlpha=1;
  // Magnificent golden armor — Lord of Cinder
  px(ctx,x+10,y+24,60,34,gold); px(ctx,x+12,y+26,56,14,goldHi);
  // Chest sunlight detail
  ctx.globalAlpha=0.4;
  px(ctx,x+24,y+28,32,16,goldHi);
  ctx.globalAlpha=0.2; for(let i=0;i<6;i++){ const a=G.frame*0.04+i*Math.PI/3; px(ctx,x+40+Math.cos(a)*16,y+36+Math.sin(a)*10,4,4,'#ffff88'); }
  ctx.globalAlpha=1;
  // Sunlight Greatsword — iconic, burning
  if(state==='attack'){
    px(ctx,x+64,y-22,8,78,bladeC); px(ctx,x+60,y-26,16,10,gold);
    ctx.globalAlpha=p2?0.9:0.6;
    for(let i=0;i<8;i++) px(ctx,x+58+((i%2)*6),y-18+i*10,10,7,i%2?'#ffcc00':'#ff8800');
    ctx.globalAlpha=1;
  } else {
    px(ctx,x+64,y+8,7,60,bladeC); px(ctx,x+60,y+6,14,8,gold);
    ctx.globalAlpha=0.45; for(let i=0;i<4;i++) px(ctx,x+60,y+12+i*14,10,8,'#ffcc00'); ctx.globalAlpha=1;
  }
  // Arms — golden gauntlets
  px(ctx,x+2,y+26,12,24,gold); px(ctx,x+4,y+28,8,10,goldHi);
  px(ctx,x+66,y+26,12,24,gold); px(ctx,x+68,y+28,8,10,goldHi);
  // Legs
  const lw=state==='walk'?Math.floor(Date.now()/102)%2*5:0;
  px(ctx,x+14,y+58,24,20,gold); px(ctx,x+14,y+76,22,10,goldLo);
  px(ctx,x+44,y+58+lw,24,20,gold); px(ctx,x+44,y+76+lw,22,10,goldLo);
  if(p2){ctx.globalAlpha=.22;px(ctx,x-2,y-4,84,92,'#ffaa00');ctx.globalAlpha=.1;px(ctx,x-6,y-8,92,100,'#ffcc00');ctx.globalAlpha=1;}
}

function drawYhorm(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#8a3818':'#5a2010', c2=p2?'#cc6030':'#8a3818';
  if(p2) bossGlow(ctx,x+44,y+44,85,'#ff8800',0.25);
  // Massive war crown — huge jagged metal
  px(ctx,x+10,y-16,68,10,'#5a4020'); px(ctx,x+6,y-12,76,6,'#7a5830');
  for(let i=0;i<5;i++) px(ctx,x+12+i*14,y-22,8,10,'#6a4828');
  // Giant head — broad, scarred
  px(ctx,x+12,y-2,64,24,c1); px(ctx,x+14,y+0,60,10,c2);
  px(ctx,x+10,y+20,68,4,'#3a1808'); // chin shadow
  // Glowing golden eyes — wide set
  px(ctx,x+18,y+4,12,8,'#ffcc44'); px(ctx,x+58,y+4,12,8,'#ffcc44');
  px(ctx,x+20,y+5,8,5,'#ffffff'); px(ctx,x+60,y+5,8,5,'#ffffff');
  px(ctx,x+22,y+6,4,3,'#000'); px(ctx,x+62,y+6,4,3,'#000');
  // Very wide belly — king of giants
  px(ctx,x+0,y+24,88,44,c1); px(ctx,x+4,y+26,80,16,c2);
  // Belly crease detail
  ctx.globalAlpha=0.25; px(ctx,x+8,y+40,72,10,'#3a1808'); ctx.globalAlpha=1;
  // Battle scars on torso
  ctx.globalAlpha=0.4;
  px(ctx,x+18,y+30,4,14,'#3a1000'); px(ctx,x+52,y+28,3,10,'#3a1000');
  ctx.globalAlpha=1;
  // Stubby vestigial wings — dark, tattered
  ctx.globalAlpha=0.65;
  px(ctx,x-10,y+8,14,34,'#552211'); px(ctx,x-12,y+6,10,10,c1);
  px(ctx,x+84,y+8,14,34,'#552211'); px(ctx,x+88,y+6,10,10,c1);
  ctx.globalAlpha=1;
  // Massive arms
  px(ctx,x-4,y+24,14,28,c1); px(ctx,x-2,y+26,10,12,c2);
  px(ctx,x+78,y+24,14,28,c1); px(ctx,x+80,y+26,10,12,c2);
  // Fists — giant knuckles
  px(ctx,x-6,y+50,18,12,c2); px(ctx,x+76,y+50,18,12,c2);
  // Giant cleaver / war club
  if(state==='attack'){
    px(ctx,x+80,y-14,18,58,c2); px(ctx,x+76,y-18,26,18,c1);
    ctx.globalAlpha=0.55; px(ctx,x+74,y-16,30,60,'#ff6600'); ctx.globalAlpha=1;
    // Impact sparks
    ctx.globalAlpha=0.7;
    for(let i=0;i<4;i++) px(ctx,x+76+i*5,y-20,6,6,'#ffcc44');
    ctx.globalAlpha=1;
  } else {
    px(ctx,x+80,y+6,16,46,c2); px(ctx,x+76,y+4,22,14,c1);
  }
  // Stumpy wide legs
  const lw=state==='walk'?Math.floor(Date.now()/120)%2*5:0;
  px(ctx,x+8,y+68,30,22,c1); px(ctx,x+10,y+88,28,10,'#3a1808');
  px(ctx,x+50,y+68+lw,30,22,c1); px(ctx,x+52,y+88+lw,28,10,'#3a1808');
  // Toenails
  for(let i=0;i<3;i++) { px(ctx,x+7+i*10,y+90,7,7,'#442208'); px(ctx,x+50+i*10,y+90+lw,7,7,'#442208'); }
  if(p2){ctx.globalAlpha=.3;px(ctx,x-4,y-4,96,100,'#ff4400');ctx.globalAlpha=.12;px(ctx,x-8,y-8,104,108,'#ff8800');ctx.globalAlpha=1;}
}

// Pontiff Sulyvahn — twin blade sorcerer
function drawPontiff(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#220033':'#110022',c2=p2?'#441166':'#220844';
  // Long dark robe
  px(ctx,x+14,y+8,44,50,c1);px(ctx,x+16,y+10,40,16,c2);
  // Headdress / mitre
  px(ctx,x+22,y-10,28,14,'#330055');px(ctx,x+26,y-14,20,6,'#550088');
  // Eyes — two glowing
  px(ctx,x+26,y+2,8,6,p2?'#ff00ff':'#8800cc');px(ctx,x+42,y+2,8,6,p2?'#ff00ff':'#8800cc');
  // Twin blades — fire and dark
  if(state==='attack'){
    px(ctx,x+58,y-12,5,52,'#ff4400');px(ctx,x+63,y-14,10,6,c1);// fire blade
    ctx.globalAlpha=0.8;px(ctx,x+56,y-10,8,52,'#ff6600');ctx.globalAlpha=1;
    px(ctx,x-4,y-6,5,48,'#4400ff');px(ctx,x-10,y-8,10,6,c1);// dark blade
    ctx.globalAlpha=0.6;px(ctx,x-6,y-4,8,48,'#6622ff');ctx.globalAlpha=1;
  }else{
    px(ctx,x+58,y+6,4,40,'#882200');
    px(ctx,x-2,y+8,4,36,'#220088');
  }
  // Cape flow
  ctx.globalAlpha=0.5;px(ctx,x+6,y+28,8,28,c2);px(ctx,x+62,y+28,8,28,c2);ctx.globalAlpha=1;
  const lw=state==='walk'?Math.floor(Date.now()/90)%2*4:0;
  px(ctx,x+18,y+58,16,22,c1);px(ctx,x+18,y+80,14,8,c2);
  px(ctx,x+38,y+58+lw,16,22,c1);px(ctx,x+38,y+80+lw,14,8,c2);
  if(p2){ctx.globalAlpha=.25;px(ctx,x,y,72,88,'#550088');ctx.globalAlpha=1;}
}

// Dragonslayer Armour — empty enchanted iron suit
function drawDragonslayer(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#334455':'#1a2233',c2=p2?'#556677':'#2a3344';
  // Heavy armored body
  px(ctx,x+12,y+8,56,50,c1);px(ctx,x+14,y+10,52,20,c2);
  // Barrel helm
  px(ctx,x+18,y-4,44,16,c1);px(ctx,x+20,y-2,10,8,p2?'#4499ff':'#224488');px(ctx,x+50,y-2,10,8,p2?'#4499ff':'#224488');
  // Broad shield (left)
  px(ctx,x+2,y+6,14,40,p2?'#445566':'#2a3344');px(ctx,x+0,y+4,18,6,c2);
  // Massive greataxe (right)
  if(state==='attack'){
    px(ctx,x+68,y-18,8,72,'#778899');
    px(ctx,x+64,y-22,20,14,c1);
    if(p2){ctx.globalAlpha=.7;px(ctx,x+62,y-20,24,74,'#3366aa');ctx.globalAlpha=1;}
  }else{px(ctx,x+68,y+4,6,58,'#556677');}
  px(ctx,x+2,y+10,10,24,c1);px(ctx,x+68,y+10,10,24,c1);
  const lw=state==='walk'?Math.floor(Date.now()/120)%2*5:0;
  px(ctx,x+14,y+58,22,22,c1);px(ctx,x+14,y+80,20,8,c2);
  px(ctx,x+44,y+58+lw,22,22,c1);px(ctx,x+44,y+80+lw,20,8,c2);
  if(p2){ctx.globalAlpha=.22;px(ctx,x,y,80,90,'#3366cc');ctx.globalAlpha=1;}
}

// Twin Princes — Lorian (big) carries Lothric (small) on his back
function drawTwinPrinces(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const lc='#221144',lc2='#443366'; // Lorian colors
  const pc=p2?'#cc44ff':'#8822cc';  // Lothric magic color
  // Lorian — large armored knight, hunched
  px(ctx,x+8,y+12,62,46,lc);px(ctx,x+10,y+14,58,18,lc2);
  px(ctx,x+14,y+2,40,14,lc);px(ctx,x+18,y+4,10,7,p2?'#ff88ff':'#8844cc');px(ctx,x+38,y+4,10,7,p2?'#ff88ff':'#8844cc');
  // Lothric on back — small, reaches forward to cast
  px(ctx,x+24,y-12,28,16,'#110022');px(ctx,x+28,y-10,8,6,pc);px(ctx,x+42,y-10,8,6,pc);
  ctx.globalAlpha=0.7;px(ctx,x+20,y-16,36,6,pc);ctx.globalAlpha=1; // Lothric cast beam
  // Lorian greatsword
  if(state==='attack'){
    px(ctx,x+68,y-16,8,68,'#9977aa');
    if(p2){ctx.globalAlpha=.7;for(let i=0;i<6;i++)px(ctx,x+64+i*2,y-14+i*10,10,6,pc);ctx.globalAlpha=1;}
  }else{px(ctx,x+68,y+6,6,52,'#7755aa');}
  px(ctx,x+2,y+14,10,24,lc);px(ctx,x+70,y+14,10,24,lc);
  const lw=state==='walk'?Math.floor(Date.now()/110)%2*5:0;
  px(ctx,x+10,y+58,22,22,lc);px(ctx,x+10,y+80,20,8,lc2);
  px(ctx,x+46,y+58+lw,22,22,lc);px(ctx,x+46,y+80+lw,20,8,lc2);
  if(p2){ctx.globalAlpha=.28;px(ctx,x,y,80,90,'#6600cc');ctx.globalAlpha=1;}
}

// Oceiros — mad dragon scholar, long neck, wild eyes
function drawOceiros(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#334422':'#1a2210',c2=p2?'#557733':'#2a3a18';
  const scaleC=p2?'#446633':'#223322';
  // Dragon body
  px(ctx,x+8,y+18,68,32,c1);px(ctx,x+10,y+20,64,12,c2);
  // Scale texture
  for(let i=0;i<5;i++){ctx.globalAlpha=.3;px(ctx,x+12+i*12,y+18,8,8,scaleC);ctx.globalAlpha=1;}
  // Long neck + head
  px(ctx,x+0,y+2,18,22,c1);
  px(ctx,x-8,y-2,14,12,c1);// snout
  px(ctx,x-6,y+0,5,5,p2?'#ff0000':'#88cc00');
  // Sceptre / staff
  if(state==='attack'){
    px(ctx,x+72,y-14,4,52,'#886655');px(ctx,x+68,y-18,12,8,c2);
    ctx.globalAlpha=.8;for(let i=0;i<4;i++)px(ctx,x+66+i*4,y-12+i*8,8,5,'#88ff44');ctx.globalAlpha=1;
  }else{px(ctx,x+72,y+2,4,44,'#665544');}
  // Tail
  const tt=Math.floor(Date.now()/120)%2*4;
  px(ctx,x+70,y+22+tt,14,10,c1);px(ctx,x+82,y+26+tt,10,8,c2);
  // Legs
  const lw=state==='walk'?Math.floor(Date.now()/100)%2*5:0;
  px(ctx,x+12,y+50,18,20,c1);px(ctx,x+12,y+70,16,6,'#1a2a08');
  px(ctx,x+56,y+50+lw,18,20,c1);px(ctx,x+56,y+70+lw,16,6,'#1a2a08');
  if(p2){ctx.globalAlpha=.2;px(ctx,x,y,88,78,'#448844');ctx.globalAlpha=1;}
}

// Abyss Watchers — multiple identical red-eyed warriors
function drawAbyssWatchers(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#3a0a0a':'#1a0505',c2=p2?'#660f0f':'#330808';
  const count=p2?3:2;
  for(let k=0;k<count;k++){
    const ox=k*14-count*7, oy=k*8-4;
    ctx.globalAlpha=p2?0.85:0.9;
    // Body
    px(ctx,x+16+ox,y+10+oy,38,38,c1);px(ctx,x+18+ox,y+12+oy,34,14,c2);
    // Helm
    px(ctx,x+20+ox,y+0+oy,30,12,c1);
    px(ctx,x+24+ox,y+2+oy,7,6,p2?'#ff0000':'#cc2200');px(ctx,x+39+ox,y+2+oy,7,6,p2?'#ff0000':'#cc2200');
    // Curved greatsword (Farron)
    if(state==='attack'){
      px(ctx,x+54+ox,y-8+oy,6,50,'#aa4422');px(ctx,x+50+ox,y-12+oy,14,8,c1);
    }else{px(ctx,x+52+ox,y+4+oy,5,38,'#883322');}
  }
  ctx.globalAlpha=1;
  const lw=state==='walk'?Math.floor(Date.now()/95)%2*5:0;
  px(ctx,x+18,y+48,14,22,c1);px(ctx,x+18,y+70,12,6,c2);
  px(ctx,x+36,y+48+lw,14,22,c1);px(ctx,x+36,y+70+lw,12,6,c2);
  if(p2){ctx.globalAlpha=.3;px(ctx,x-4,y-4,80,82,'#880000');ctx.globalAlpha=.14;px(ctx,x-8,y-8,92,92,'#ff0000');ctx.globalAlpha=1;}
}

// ============================================================
// NEW BOSS ART FUNCTIONS (v14)
// ============================================================

// Champion Gundyr — black-armored berserker, coiled chains, burning core
function drawChampionGundyr(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#1a0800':'#0a0404', c2=p2?'#3a1000':'#1a0808';
  const fireC=p2?'#ff6600':'#cc3300';
  // Hulking armored body
  px(ctx,x+8,y+8,60,52,c1); px(ctx,x+10,y+10,56,18,c2);
  // Helmet with horns
  px(ctx,x+14,y-2,48,16,c1);
  px(ctx,x+12,y-10,6,12,'#110000'); px(ctx,x+58,y-10,6,12,'#110000'); // horns
  px(ctx,x+16,y+2,12,8,p2?'#ff4400':'#661100'); px(ctx,x+48,y+2,12,8,p2?'#ff4400':'#661100'); // eyes
  // Chains wrapped around body
  ctx.globalAlpha=0.55;
  for(let i=0;i<4;i++) px(ctx,x+6,y+14+i*10,64,3,'#443322');
  ctx.globalAlpha=1;
  // Burning coil core — visible in chest
  if(p2){ctx.globalAlpha=0.7; px(ctx,x+26,y+22,24,16,fireC); ctx.globalAlpha=0.4; px(ctx,x+22,y+18,32,24,'#ff8800'); ctx.globalAlpha=1;}
  // Halberd
  if(state==='attack'){
    px(ctx,x+68,y-22,6,80,'#778899'); px(ctx,x+62,y-26,18,12,c1);
    if(p2){ctx.globalAlpha=0.8; px(ctx,x+64,y-20,12,80,fireC); ctx.globalAlpha=1;}
  } else { px(ctx,x+68,y+4,5,62,'#556677'); }
  px(ctx,x+0,y+12,10,28,c1); px(ctx,x+66,y+12,10,28,c1);
  const lw=state==='walk'?Math.floor(Date.now()/100)%2*5:0;
  px(ctx,x+12,y+60,22,22,c1); px(ctx,x+12,y+82,20,8,c2);
  px(ctx,x+44,y+60+lw,22,22,c1); px(ctx,x+44,y+82+lw,20,8,c2);
  if(p2){ctx.globalAlpha=.3; px(ctx,x-2,y-4,82,94,'#ff4400'); ctx.globalAlpha=1;}
}

// Sister Friede — slender frost cleric with a scythe and ash robes
function drawSisterFriede(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#0a1a2a':'#060c14', c2=p2?'#1a3a5a':'#0e2030';
  const frostC=p2?'#88eeff':'#44aacc';
  // Long flowing ash robes
  px(ctx,x+14,y+10,44,54,c1); px(ctx,x+16,y+12,40,16,c2);
  // Cape/veil flowing behind
  ctx.globalAlpha=0.45;
  px(ctx,x+4,y+14,12,44,c2); px(ctx,x+60,y+14,12,44,c2);
  ctx.globalAlpha=1;
  // Head — white veiled
  px(ctx,x+20,y-2,32,14,c1);
  px(ctx,x+22,y+0,8,6,p2?'#ffffff':'#ccddee'); px(ctx,x+42,y+0,8,6,p2?'#ffffff':'#ccddee'); // eyes
  // Frost halo in p2
  if(p2){ ctx.globalAlpha=0.3; for(let i=0;i<8;i++){const a=i*Math.PI/4+(G.frame*0.05); px(ctx,x+36+Math.cos(a)*22,y+6+Math.sin(a)*10,5,5,frostC);} ctx.globalAlpha=1; }
  // Scythe
  if(state==='attack'){
    px(ctx,x+62,y-18,4,72,'#aaaacc'); px(ctx,x+50,y-22,20,8,'#ccccee');
    ctx.globalAlpha=0.7; for(let i=0;i<5;i++) px(ctx,x+52+i*4,y-20+i*6,6,4,frostC); ctx.globalAlpha=1;
  } else { px(ctx,x+62,y+8,4,56,'#8888aa'); px(ctx,x+50,y+4,18,8,'#aaaacc'); }
  const lw=state==='walk'?Math.floor(Date.now()/120)%2*4:0;
  px(ctx,x+18,y+64,14,18,c1); px(ctx,x+18,y+82,12,6,c2);
  px(ctx,x+40,y+64+lw,14,18,c1); px(ctx,x+40,y+82+lw,12,6,c2);
  if(p2){ctx.globalAlpha=.25; px(ctx,x,y,72,90,'#2266aa'); ctx.globalAlpha=1;}
}

// Nameless King — god-king with golden armor, lightning crown, dragon-scale cape
function drawNamelessKing(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#2a2000':'#181000', c2=p2?'#5a4400':'#302200';
  const goldC=p2?'#ffdd44':'#cc9900';
  const lightC='#aaddff';
  // Broad golden body
  px(ctx,x+10,y+8,56,50,c1); px(ctx,x+12,y+10,52,18,c2);
  // Dragon-scale cape
  ctx.globalAlpha=0.5;
  for(let i=0;i<5;i++) px(ctx,x+4,y+12+i*10,10,8,c2);
  for(let i=0;i<5;i++) px(ctx,x+62,y+12+i*10,10,8,c2);
  ctx.globalAlpha=1;
  // Golden helm with lightning crown
  px(ctx,x+16,y-2,44,16,c1); px(ctx,x+18,y+0,40,8,c2);
  // Crown spires
  const cr=p2?goldC:'#aa8800';
  for(let i=0;i<5;i++) px(ctx,x+17+i*8,y-8-(i===2?6:i===1||i===3?3:0),4,10,cr);
  // Eyes — golden glow
  px(ctx,x+20,y+2,10,7,p2?'#ffee00':'#cc8800'); px(ctx,x+46,y+2,10,7,p2?'#ffee00':'#cc8800');
  // Dragonslayer swordspear
  if(state==='attack'){
    px(ctx,x+68,y-20,6,76,'#ccaa44'); px(ctx,x+62,y-24,18,10,c1);
    ctx.globalAlpha=0.85;
    for(let i=0;i<6;i++) px(ctx,x+64+i*3,y-18+i*10,8,5,lightC);
    ctx.globalAlpha=1;
  } else { px(ctx,x+68,y+6,5,58,'#aa8833'); }
  px(ctx,x+2,y+12,10,26,c1); px(ctx,x+64,y+12,10,26,c1);
  const lw=state==='walk'?Math.floor(Date.now()/105)%2*5:0;
  px(ctx,x+14,y+58,22,22,c1); px(ctx,x+14,y+80,20,8,c2);
  px(ctx,x+46,y+58+lw,22,22,c1); px(ctx,x+46,y+80+lw,20,8,c2);
  if(p2){ctx.globalAlpha=.3; px(ctx,x-2,y-6,82,96,goldC); ctx.globalAlpha=1;}
}

// Fume Knight — dark knight with ultra greatsword + dark greatshield
function drawFumeKnight(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#1a001a':'#0a0008', c2=p2?'#3a0038':'#1a0018';
  const fumeC=p2?'#dd44dd':'#880088';
  // Massive dark plate body
  px(ctx,x+8,y+6,60,54,c1); px(ctx,x+10,y+8,56,20,c2);
  // Dark fume wisps from armor
  if(p2){ ctx.globalAlpha=0.3; for(let i=0;i<4;i++) px(ctx,x+10+i*14,y+4,8,12,fumeC); ctx.globalAlpha=1; }
  // Flat-topped helm
  px(ctx,x+14,y-4,48,18,c1); px(ctx,x+16,y-2,44,6,c2);
  px(ctx,x+18,y+2,10,7,p2?'#ff44ff':'#660066'); px(ctx,x+48,y+2,10,7,p2?'#ff44ff':'#660066');
  // Shield (left) — massive
  px(ctx,x-8,y+4,18,50,p2?'#2a0028':'#160014');
  px(ctx,x-10,y+2,22,6,c2);
  px(ctx,x-6,y+8,10,28,p2?'#440044':'#220022');
  // Ultra greatsword (right)
  if(state==='attack'){
    px(ctx,x+68,y-26,8,86,'#998899'); px(ctx,x+62,y-30,20,12,c1);
    if(p2){ctx.globalAlpha=0.7; px(ctx,x+66,y-24,12,86,fumeC); ctx.globalAlpha=1;}
  } else { px(ctx,x+68,y+2,7,68,'#776677'); }
  px(ctx,x+0,y+10,10,28,c1); px(ctx,x+68,y+10,10,28,c1);
  const lw=state==='walk'?Math.floor(Date.now()/115)%2*5:0;
  px(ctx,x+12,y+60,22,22,c1); px(ctx,x+12,y+82,20,8,c2);
  px(ctx,x+44,y+60+lw,22,22,c1); px(ctx,x+44,y+82+lw,20,8,c2);
  if(p2){ctx.globalAlpha=.28; px(ctx,x,y,76,90,fumeC); ctx.globalAlpha=1;}
}

// Darklurker — angelic winged creature of the Abyss, splits into two in phase 2
function drawDarklurker(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const c1=p2?'#0000aa':'#000055', c2=p2?'#2222cc':'#111188';
  const darkC=p2?'#4466ff':'#2233cc';
  const count=p2?2:1;
  for(let k=0;k<count;k++){
    const ox=k*(p2?-30:0), oy=k*(p2?8:0);
    ctx.globalAlpha=p2?0.75:1;
    // Angelic wings — large spread
    ctx.globalAlpha*=0.55;
    px(ctx,x+ox-18,y+oy+4,20,44,c2); // left wing
    px(ctx,x+ox-12,y+oy-2,12,12,darkC);
    px(ctx,x+ox+70,y+oy+4,20,44,c2); // right wing
    px(ctx,x+ox+62,y+oy-2,12,12,darkC);
    ctx.globalAlpha*=(1/0.55);
    // Slim body — floating
    px(ctx,x+ox+20,y+oy+6,32,40,c1); px(ctx,x+ox+22,y+oy+8,28,14,c2);
    // Featureless face, glowing orb eyes
    px(ctx,x+ox+22,y+oy-2,28,12,c1);
    px(ctx,x+ox+24,y+oy+0,8,6,p2?'#ffffff':'#8888ff');
    px(ctx,x+ox+40,y+oy+0,8,6,p2?'#ffffff':'#8888ff');
    // Dark orbs in hands
    if(state==='attack'){
      ctx.globalAlpha*=0.9;
      px(ctx,x+ox+56,y+oy+18,12,12,p2?'#ffffff':darkC); // right orb
      px(ctx,x+ox+4,y+oy+18,12,12,p2?'#ffffff':darkC);  // left orb
      // Orb glow
      ctx.globalAlpha*=0.4;
      px(ctx,x+ox+52,y+oy+14,20,20,darkC);
      px(ctx,x+ox+0,y+oy+14,20,20,darkC);
      ctx.globalAlpha*=(1/0.4);
    }
    // Hovering — no legs, wispy tail
    const wt=Math.floor(Date.now()/80)%2*3;
    px(ctx,x+ox+26,y+oy+46,10,20,c1); px(ctx,x+ox+36,y+oy+46+wt,10,20,c1);
    ctx.globalAlpha=1;
  }
  if(p2){ctx.globalAlpha=.2; px(ctx,x-20,y-10,112,90,'#0022ff'); ctx.globalAlpha=1;}
}

function drawVelstadt(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const armorC=p2?'#aa8822':'#665511';
  const darkC=p2?'#ffdd44':'#aa8822';
  const robeC='#221100';
  // Massive frame — wide helm, dark robes
  px(ctx,x+16,y+2,48,14,armorC);   // great helm
  px(ctx,x+12,y-4,56,10,armorC);   // helm visor ridge
  // Glowing eye slits
  ctx.globalAlpha=0.9;
  px(ctx,x+20,y+4,10,4,darkC); px(ctx,x+50,y+4,10,4,darkC);
  ctx.globalAlpha=1;
  px(ctx,x+10,y+16,60,44,robeC); // dark robes
  px(ctx,x+14,y+18,52,12,armorC); // shoulder plates
  // Massive bell weapon
  if(state==='attack'){
    px(ctx,x+64,y+10,18,46,'#887733'); // handle
    px(ctx,x+60,y+50,26,22,'#998844'); // bell head
    ctx.globalAlpha=0.4; px(ctx,x+58,y+48,30,26,darkC); ctx.globalAlpha=1; // glow
  } else {
    px(ctx,x+62,y+16,14,38,'#887733');
    px(ctx,x+58,y+48,22,18,'#998844');
  }
  // Legs — big armored boots
  px(ctx,x+18,y+60,20,22,armorC); px(ctx,x+42,y+60,20,22,armorC);
  if(p2){ ctx.globalAlpha=0.25; px(ctx,x+8,y-6,64,90,'#ffcc44'); ctx.globalAlpha=1; }
}

function drawDemonPrince(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const bodyC=p2?'#cc2200':'#882200';
  const wingC=p2?'#ff6600':'#661100';
  const fireC=p2?'#ffaa00':'#ff4400';
  const t=Math.floor(Date.now()/80)%2;
  // Large winged demon body
  // Wings
  ctx.globalAlpha=0.7;
  px(ctx,x-24,y+8,32,52,wingC); px(ctx,x-28,y+2,16,18,wingC); // left wing
  px(ctx,x+72,y+8,32,52,wingC); px(ctx,x+84,y+2,16,18,wingC); // right wing
  ctx.globalAlpha=1;
  // Demon body
  px(ctx,x+14,y+6,52,54,bodyC);
  px(ctx,x+18,y+2,44,14,bodyC); // neck
  // Head — horns
  px(ctx,x+20,y-14,40,22,bodyC);
  px(ctx,x+18,y-26,6,18,'#cc6600'); // left horn
  px(ctx,x+56,y-26,6,18,'#cc6600'); // right horn
  // Eyes — two blazing orbs
  px(ctx,x+26,y-10,10,8,p2?'#ffffff':fireC);
  px(ctx,x+44,y-10,10,8,p2?'#ffffff':fireC);
  // Chaos fire breath in attack state
  if(state==='attack'){
    ctx.globalAlpha=0.85-t*0.2;
    px(ctx,x+18,y+14,48,32,p2?'#ffff00':'#ff6600'); // fire burst
    ctx.globalAlpha=0.5; px(ctx,x+4,y+10,70,40,'#ff2200'); ctx.globalAlpha=1;
    for(let i=0;i<5;i++) px(ctx,x+10+i*14,y+8+t*6,8,18,fireC);
  }
  // Clawed feet
  px(ctx,x+20,y+60,18,18,bodyC); px(ctx,x+42,y+60,18,18,bodyC);
  if(p2){ ctx.globalAlpha=0.2; px(ctx,x-24,y-14,128,100,'#ff2200'); ctx.globalAlpha=1; }
}

function drawHalflight(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const armorC=p2?'#aaccff':'#6688aa';
  const capeC=p2?'#2244aa':'#112244';
  const goldC=p2?'#ffffff':'#ccddff';
  // Knight of the ringed city — elegant, slim, glowing armor
  // Cape
  ctx.globalAlpha=0.8;
  px(ctx,x+8,y+16,10,52,capeC); // left cape sweep
  px(ctx,x+62,y+16,10,52,capeC); // right
  ctx.globalAlpha=1;
  // Body
  px(ctx,x+18,y+16,44,44,armorC);
  // Shoulders
  px(ctx,x+10,y+14,16,18,armorC); px(ctx,x+54,y+14,16,18,armorC);
  // Helm — with face guard
  px(ctx,x+20,y-4,40,26,armorC);
  px(ctx,x+24,y-10,32,12,armorC); // crest
  // Eyes — two glowing narrow slits
  ctx.globalAlpha=0.9;
  px(ctx,x+26,y+0,10,5,goldC); px(ctx,x+44,y+0,10,5,goldC);
  ctx.globalAlpha=1;
  // Spear of the church — long shining weapon
  if(state==='attack'){
    px(ctx,x+62,y-20,4,70,'#8899bb'); // shaft
    px(ctx,x+58,y-28,12,18,'#ddeeff'); // tip
    ctx.globalAlpha=p2?0.8:0.5;
    px(ctx,x+54,y-32,20,78,goldC); // glow column
    ctx.globalAlpha=1;
  } else {
    px(ctx,x+62,y-12,3,60,'#8899bb');
    px(ctx,x+60,y-20,8,14,'#ddeeff');
  }
  // Legs
  px(ctx,x+22,y+60,18,24,armorC); px(ctx,x+40,y+60,18,24,armorC);
  if(p2){ ctx.globalAlpha=0.18; px(ctx,x+8,y-12,64,100,'#88ccff'); ctx.globalAlpha=1; }
}


function drawHalflight(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const armorC=p2?'#aaccff':'#6688aa';
  const capeC=p2?'#2244aa':'#112244';
  const goldC=p2?'#ffffff':'#ccddff';
  ctx.globalAlpha=0.8;
  px(ctx,x+8,y+16,10,52,capeC); px(ctx,x+62,y+16,10,52,capeC);
  ctx.globalAlpha=1;
  px(ctx,x+18,y+16,44,44,armorC);
  px(ctx,x+10,y+14,16,18,armorC); px(ctx,x+54,y+14,16,18,armorC);
  px(ctx,x+20,y-4,40,26,armorC);
  px(ctx,x+24,y-10,32,12,armorC);
  ctx.globalAlpha=0.9;
  px(ctx,x+26,y+0,10,5,goldC); px(ctx,x+44,y+0,10,5,goldC);
  ctx.globalAlpha=1;
  if(state==='attack'){
    px(ctx,x+62,y-20,4,70,'#8899bb'); px(ctx,x+58,y-28,12,18,'#ddeeff');
    ctx.globalAlpha=p2?0.8:0.5; px(ctx,x+54,y-32,20,78,goldC); ctx.globalAlpha=1;
  } else { px(ctx,x+62,y-12,3,60,'#8899bb'); px(ctx,x+60,y-20,8,14,'#ddeeff'); }
  px(ctx,x+22,y+60,18,24,armorC); px(ctx,x+40,y+60,18,24,armorC);
  if(p2){ ctx.globalAlpha=0.18; px(ctx,x+8,y-12,64,100,'#88ccff'); ctx.globalAlpha=1; }
}

function drawGael(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const robeC=p2?'#880022':'#551100';
  const capeC=p2?'#660011':'#330008';
  const goldC=p2?'#ff4444':'#cc2222';
  const t=Math.floor(Date.now()/70)%2;
  // Large flowing red cape
  ctx.globalAlpha=0.85;
  px(ctx,x-10,y+10,22,60,capeC); // left cape
  px(ctx,x+68,y+10,22,60,capeC); // right cape
  ctx.globalAlpha=1;
  // Body — hunched, powerful
  px(ctx,x+14,y+12,52,50,robeC);
  px(ctx,x+10,y+8,20,18,robeC); // left shoulder
  px(ctx,x+50,y+8,20,18,robeC); // right shoulder
  // Head — ancient, decayed face
  px(ctx,x+20,y-4,40,24,robeC);
  px(ctx,x+18,y-8,44,10,robeC);
  // Glowing blood-red eyes
  px(ctx,x+22,y-2,10,7,p2?'#ff8888':goldC);
  px(ctx,x+48,y-2,10,7,p2?'#ff8888':goldC);
  // Dark Soul fragments floating around in phase 2
  if(p2){
    ctx.globalAlpha=0.7;
    for(let i=0;i<5;i++){
      const a=G.frame*0.06+i*(Math.PI*2/5);
      const r=44+Math.sin(G.frame*0.1+i)*8;
      px(ctx,x+40+Math.cos(a)*r-4,y+30+Math.sin(a)*r*0.5-4,8,8,'#cc0033');
    }
    ctx.globalAlpha=1;
  }
  // Greatsword crossbow weapon
  if(state==='attack'){
    px(ctx,x-10,y+14,22,6,'#886644'); // crossbow stock
    px(ctx,x-14,y+6,8,22,'#666666'); // prod
    px(ctx,x-2,y+10,4,36,'#777755'); // tiller
    ctx.globalAlpha=0.5+t*0.2; px(ctx,x-18,y+4,18,26,goldC); ctx.globalAlpha=1;
    // Blood particles
    if(p2) for(let i=0;i<3;i++) px(ctx,x+20+i*14,y+16+t*4,6,14,'#cc0022');
  } else {
    px(ctx,x-8,y+16,18,5,'#886644');
    px(ctx,x-12,y+10,6,18,'#666666');
  }
  // Legs
  px(ctx,x+22,y+62,20,24,robeC); px(ctx,x+38,y+62+t*2,20,24,robeC);
  if(p2){ ctx.globalAlpha=0.22; px(ctx,x-10,y-8,100,100,'#880022'); ctx.globalAlpha=1; }
}

function drawFriedeFinal(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const robeC=p2?'#2222aa':'#111166';
  const flameC=p2?'#4444ff':'#2222cc';
  const t=Math.floor(Date.now()/80)%2;
  // Blackflame aura
  if(p2){
    ctx.globalAlpha=0.3;
    for(let i=0;i<6;i++){
      const a=G.frame*0.07+i*(Math.PI*2/6);
      px(ctx,x+40+Math.cos(a)*50-5,y+35+Math.sin(a)*20-5,10,10,flameC);
    }
    ctx.globalAlpha=1;
  }
  // Elegant flowing dress
  ctx.globalAlpha=0.9;
  px(ctx,x+4,y+14,16,56,robeC); // left skirt
  px(ctx,x+60,y+14,16,56,robeC); // right skirt
  ctx.globalAlpha=1;
  px(ctx,x+18,y+10,44,52,robeC);
  px(ctx,x+12,y+8,18,16,robeC); // shoulder
  px(ctx,x+50,y+8,18,16,robeC);
  // Head — white hair, pale face
  px(ctx,x+20,y-6,40,26,'#ddddff'); // white hair
  px(ctx,x+24,y-2,32,18,robeC);
  // Hollow black eyes
  px(ctx,x+26,y+2,10,7,'#000000'); px(ctx,x+44,y+2,10,7,'#000000');
  ctx.globalAlpha=0.8;
  px(ctx,x+28,y+3,6,5,flameC); px(ctx,x+46,y+3,6,5,flameC); // flame in eyes
  ctx.globalAlpha=1;
  // Blackflame scythes
  if(state==='attack'){
    // Left scythe
    ctx.save(); ctx.translate(x+10,y+20); ctx.rotate(0.4);
    px(ctx,0,0,3,44,'#3a2a10'); // staff
    px(ctx,0,-8,24,8,'#2233aa'); // blackflame blade
    ctx.globalAlpha=0.5; px(ctx,-2,-12,28,18,flameC); ctx.globalAlpha=1;
    ctx.restore();
    // Right scythe
    ctx.save(); ctx.translate(x+70,y+20); ctx.rotate(-0.4);
    px(ctx,0,0,3,44,'#3a2a10');
    px(ctx,-24,-8,24,8,'#2233aa');
    ctx.globalAlpha=0.5; px(ctx,-26,-12,28,18,flameC); ctx.globalAlpha=1;
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(x+12,y+22); ctx.rotate(0.3);
    px(ctx,0,0,2,38,'#3a2a10'); px(ctx,0,-4,20,6,'#2233aa');
    ctx.restore();
  }
  if(p2){ ctx.globalAlpha=0.18; px(ctx,x,y-10,80,100,'#1111aa'); ctx.globalAlpha=1; }
}

function drawPriscilla(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const robeC=p2?'#ffaacc':'#cc8899';
  const skinC='#fff0f0';
  const t=Math.floor(Date.now()/120)%2;
  // Long white hair
  ctx.globalAlpha=0.9;
  px(ctx,x+12,y-8,56,80,'#eeeeee');
  ctx.globalAlpha=1;
  // Slender elegant body
  px(ctx,x+22,y+8,36,50,robeC);
  px(ctx,x+18,y+6,14,14,robeC); px(ctx,x+48,y+6,14,14,robeC);
  // Head — ethereal beauty
  px(ctx,x+24,y-6,32,22,skinC);
  // Fox/dragon tail — golden
  ctx.globalAlpha=0.7;
  px(ctx,x+60,y+18,16,48,'#ccaa44');
  px(ctx,x+64,y+16,8,12,'#ddbb55');
  ctx.globalAlpha=1;
  // Eyes — golden
  px(ctx,x+26,y-2,10,7,'#ccaa00'); px(ctx,x+44,y-2,10,7,'#ccaa00');
  // Lifehunt scythe
  if(state==='attack'||p2){
    ctx.save(); ctx.translate(x+36,y+14); ctx.rotate(-0.5);
    px(ctx,0,0,3,56,'#7a6030');
    px(ctx,-20,-14,32,10,p2?'#ff4488':'#dd2266');
    px(ctx,-22,-20,8,18,p2?'#ff4488':'#dd2266');
    ctx.globalAlpha=0.4; px(ctx,-24,-22,36,28,'#ff88cc'); ctx.globalAlpha=1;
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(x+38,y+18); ctx.rotate(-0.25);
    px(ctx,0,0,2,48,'#7a6030');
    px(ctx,-14,-8,24,8,'#dd2266');
    ctx.restore();
  }
  // Legs — half invisible in phase 2
  if(p2) ctx.globalAlpha=0.4;
  px(ctx,x+26,y+58,16,22,robeC); px(ctx,x+38,y+58+t*2,16,22,robeC);
  ctx.globalAlpha=1;
  if(p2){ ctx.globalAlpha=0.15; px(ctx,x+8,y-10,64,100,'#ffaacc'); ctx.globalAlpha=1; }
}

function drawQuelaag(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const spiderC=p2?'#cc2200':'#881100';
  const skinC='#ddaaaa';
  const fireC=p2?'#ffaa00':'#ff6600';
  const t=Math.floor(Date.now()/80)%2;
  // Giant spider body (lower half)
  px(ctx,x-10,y+30,100,50,spiderC); // spider abdomen
  // Spider legs
  for(let i=0;i<4;i++){
    const lx=i<2?x-10-i*16:x+90+i*8;
    px(ctx,lx,y+28+i%2*8,6,36,spiderC);
    px(ctx,lx+(i<2?-8:4),y+58+i%2*8,5,24,spiderC);
  }
  // Human upper torso emerging from spider body
  px(ctx,x+22,y+4,36,34,skinC); // torso
  px(ctx,x+18,y+2,14,16,skinC); // left arm
  px(ctx,x+48,y+2,14,16,skinC); // right arm
  // Head — wild dark hair
  px(ctx,x+20,y-14,40,24,skinC);
  px(ctx,x+18,y-20,44,10,'#1a0000'); // dark hair
  px(ctx,x+16,y-18,48,8,'#2a0800');
  // Fire eyes
  px(ctx,x+24,y-10,10,7,p2?'#ffff00':fireC);
  px(ctx,x+46,y-10,10,7,p2?'#ffff00':fireC);
  // Chaos flame sword
  if(state==='attack'){
    px(ctx,x+60,y+2,6,38,'#552200'); // handle
    ctx.globalAlpha=0.9;
    px(ctx,x+54,y-12,14,20,p2?'#ffff00':fireC); // flame blade
    px(ctx,x+50,y-16,20,28,p2?'#ffaa00':'#ff4400');
    ctx.globalAlpha=0.4; px(ctx,x+48,y-20,24,36,'#ff8800'); ctx.globalAlpha=1;
    // Flame drip
    for(let i=0;i<3;i++) px(ctx,x+50+i*6,y+4+t*4,5,12+i*6,fireC);
  } else {
    px(ctx,x+62,y+4,5,32,'#552200');
    px(ctx,x+56,y-6,12,16,fireC);
  }
  if(p2){ ctx.globalAlpha=0.2; px(ctx,x-10,y-14,100,100,'#ff2200'); ctx.globalAlpha=1; }
}

function drawMoonlightButterfly(ctx,x,y,state,b){
  const p2=b&&b.phase===2;
  const wingC=p2?'#88ddff':'#4499cc';
  const bodyC=p2?'#ddeeff':'#aaccee';
  const crystalC=p2?'#ffffff':'#88ddff';
  const t=Math.sin(G.frame*0.07)*12;
  const t2=Math.sin(G.frame*0.05)*8;
  // Hovering butterfly — larger wings
  // Left wings
  ctx.globalAlpha=0.7;
  px(ctx,x-30+t2,y+t,50,36,wingC);
  px(ctx,x-22+t2,y+34+t,34,26,wingC);
  // Right wings
  px(ctx,x+60-t2,y+t,50,36,wingC);
  px(ctx,x+68-t2,y+34+t,34,26,wingC);
  ctx.globalAlpha=0.4;
  px(ctx,x-28+t2,y+t,46,32,crystalC);
  px(ctx,x+62-t2,y+t,46,32,crystalC);
  ctx.globalAlpha=1;
  // Crystal body
  px(ctx,x+24,y+8+t*0.3,32,44,bodyC);
  px(ctx,x+28,y+4+t*0.3,24,12,bodyC);
  // Head — gem-like
  px(ctx,x+26,y-4+t*0.3,28,18,crystalC);
  // Eyes — two brilliant points
  ctx.globalAlpha=0.9;
  px(ctx,x+28,y+0+t*0.3,8,6,p2?'#ffffff':'#44aaff');
  px(ctx,x+44,y+0+t*0.3,8,6,p2?'#ffffff':'#44aaff');
  ctx.globalAlpha=1;
  // Crystal beams when attacking
  if(state==='attack'){
    const beamY=y+20+t*0.3;
    for(let i=0;i<5;i++){
      ctx.globalAlpha=0.6-i*0.1;
      px(ctx,x+40-i*30,beamY-i*4,8+i*4,14+i*4,crystalC);
    }
    ctx.globalAlpha=1;
  }
  // No legs — floating
  ctx.globalAlpha=0.5;
  px(ctx,x+30,y+48+t*0.3,8,12,bodyC); px(ctx,x+42,y+48+t*0.3,8,12,bodyC);
  ctx.globalAlpha=1;
  if(p2){ ctx.globalAlpha=0.15; px(ctx,x-30,y-10,140,100,'#44aaff'); ctx.globalAlpha=1; }
}


function drawArena(ctx){
  const w=AW(),h=AH();
  const floorH=68;
  const floorY=h-floorH;
  const t=currentBoss?currentBoss.type:'iudex';

  // Theme palettes
  const themes={
    // Fiery / orange bosses
    asylum_demon:{sky1:'#1a0800',sky2:'#3a1005',floor1:'#2a1a08',floor2:'#1a1006',accent:'#ff4400',torch:'#ff6600'},
    stray_demon: {sky1:'#1a0800',sky2:'#3a1005',floor1:'#2a1a08',floor2:'#1a1006',accent:'#ff4400',torch:'#ff6600'},
    yhorm:       {sky1:'#1e0a00',sky2:'#3e1800',floor1:'#2e1200',floor2:'#1a0c00',accent:'#ff6600',torch:'#ff8800'},
    dancer:      {sky1:'#0a0010',sky2:'#200030',floor1:'#100020',floor2:'#080010',accent:'#cc44ff',torch:'#aa22ff'},
    soul_of_cinder:{sky1:'#1a0a00',sky2:'#2a1800',floor1:'#2a1800',floor2:'#150e00',accent:'#ffaa00',torch:'#ffcc44'},
    // Frost / blue
    vordt:       {sky1:'#000814',sky2:'#001830',floor1:'#041020',floor2:'#020a14',accent:'#44aaff',torch:'#88ccff'},
    // Magic / purple
    gwyn:        {sky1:'#100800',sky2:'#201000',floor1:'#201800',floor2:'#100c00',accent:'#ffcc44',torch:'#ffaa00'},
    manus:       {sky1:'#000005',sky2:'#050010',floor1:'#050010',floor2:'#020008',accent:'#6600cc',torch:'#4400aa'},
    four_kings:  {sky1:'#000005',sky2:'#050010',floor1:'#050010',floor2:'#020008',accent:'#6600cc',torch:'#4400aa'},
    nashandra:   {sky1:'#060004',sky2:'#100010',floor1:'#080008',floor2:'#040004',accent:'#cc00aa',torch:'#880066'},
    aldrich:     {sky1:'#04000a',sky2:'#0a0018',floor1:'#06000e',floor2:'#030008',accent:'#8800ff',torch:'#5500cc'},
    pontiff:     {sky1:'#040008',sky2:'#0c0020',floor1:'#060010',floor2:'#030008',accent:'#aa44ff',torch:'#7722cc'},
    twin_princes:{sky1:'#080008',sky2:'#150015',floor1:'#0a000a',floor2:'#050005',accent:'#cc44ff',torch:'#9922dd'},
    // Green / nature
    greatwood:   {sky1:'#000a00',sky2:'#001400',floor1:'#031203',floor2:'#020a02',accent:'#44cc44',torch:'#22aa22'},
    oceiros:     {sky1:'#010a01',sky2:'#031603',floor1:'#041404',floor2:'#020c02',accent:'#66dd22',torch:'#44aa11'},
    // Silver / iron
    dragonslayer:{sky1:'#080c10',sky2:'#101828',floor1:'#0c1420',floor2:'#080e18',accent:'#4499ff',torch:'#2266cc'},
    ornstein:    {sky1:'#100c00',sky2:'#201600',floor1:'#1a1200',floor2:'#100c00',accent:'#ddaa00',torch:'#cc8800'},
    artorias:    {sky1:'#040008',sky2:'#0a0018',floor1:'#060010',floor2:'#030008',accent:'#8844cc',torch:'#5522aa'},
    // Dragon / blood
    seath:       {sky1:'#000c14',sky2:'#001a28',floor1:'#041018',floor2:'#020c12',accent:'#44ccff',torch:'#22aaee'},
    midir:       {sky1:'#040008',sky2:'#080010',floor1:'#050008',floor2:'#030005',accent:'#8800ff',torch:'#4400cc'},
    capra_demon: {sky1:'#0c0400',sky2:'#1a0800',floor1:'#140800',floor2:'#0a0400',accent:'#cc4400',torch:'#aa3300'},
    sif:         {sky1:'#060a08',sky2:'#0e1810',floor1:'#081208',floor2:'#040a04',accent:'#88cc88',torch:'#44aa44'},
    iudex:       {sky1:'#080804',sky2:'#141208',floor1:'#101006',floor2:'#080804',accent:'#c8a840',torch:'#aa8822'},
    abyss_watchers:{sky1:'#0a0000',sky2:'#180400',floor1:'#100200',floor2:'#080200',accent:'#cc2200',torch:'#aa1100'},
    // New bosses
    champion_gundyr:{sky1:'#0a0500',sky2:'#180a00',floor1:'#120800',floor2:'#080400',accent:'#ff6600',torch:'#dd4400'},
    sister_friede:{sky1:'#000510',sky2:'#000e28',floor1:'#020810',floor2:'#01040a',accent:'#44aaff',torch:'#2266cc'},
    nameless_king:{sky1:'#080400',sky2:'#1a1000',floor1:'#141000',floor2:'#0a0800',accent:'#ffcc00',torch:'#ffaa00'},
    fume_knight:  {sky1:'#050005',sky2:'#0f000f',floor1:'#08000a',floor2:'#040005',accent:'#cc44cc',torch:'#882288'},
    darklurker:   {sky1:'#000010',sky2:'#00002a',floor1:'#000018',floor2:'#00000e',accent:'#2244ff',torch:'#1122cc'},
  };
  const th=themes[t]||themes.iudex;

  // Sky gradient
  const skyGrad=ctx.createLinearGradient(0,0,0,floorY);
  skyGrad.addColorStop(0,th.sky1);
  skyGrad.addColorStop(1,th.sky2);
  ctx.fillStyle=skyGrad;
  ctx.fillRect(0,0,w,floorY);

  // Distant arch / architecture
  ctx.globalAlpha=0.18;
  ctx.fillStyle=th.accent;
  // Left arch pillar
  ctx.fillRect(w*0.08,floorY*0.3,w*0.03,floorY*0.7);
  ctx.fillRect(w*0.06,floorY*0.28,w*0.07,floorY*0.04);
  // Right arch pillar
  ctx.fillRect(w*0.89,floorY*0.3,w*0.03,floorY*0.7);
  ctx.fillRect(w*0.87,floorY*0.28,w*0.07,floorY*0.04);
  // Back wall arch top
  ctx.fillRect(w*0.2,floorY*0.08,w*0.6,floorY*0.04);
  ctx.globalAlpha=0.08;
  ctx.fillRect(w*0.15,floorY*0.12,w*0.7,floorY*0.6);
  ctx.globalAlpha=1;

  // Fog wisps
  const fogT=G.frame*0.012;
  for(let i=0;i<3;i++){
    const fx=(Math.sin(fogT+i*2.1)*0.3+0.5)*w;
    const fy=floorY*0.5+Math.cos(fogT*0.7+i)*floorY*0.1;
    const fogGrad=ctx.createRadialGradient(fx,fy,0,fx,fy,w*0.25);
    fogGrad.addColorStop(0,th.accent+'18');
    fogGrad.addColorStop(1,'transparent');
    ctx.fillStyle=fogGrad;
    ctx.fillRect(0,0,w,floorY);
  }

  // Torches — left and right walls
  const torchFlicker=0.7+Math.sin(G.frame*0.18)*0.3;
  [[w*0.05,floorY*0.55],[w*0.95,floorY*0.55],[w*0.5,floorY*0.3]].forEach(([tx,ty])=>{
    ctx.globalAlpha=torchFlicker*0.6;
    const tg=ctx.createRadialGradient(tx,ty,0,tx,ty,w*0.12);
    tg.addColorStop(0,th.torch+'cc');
    tg.addColorStop(1,'transparent');
    ctx.fillStyle=tg;
    ctx.fillRect(tx-w*0.12,ty-w*0.12,w*0.24,w*0.24);
    // Torch bracket
    ctx.globalAlpha=0.5;
    ctx.fillStyle=th.torch;
    ctx.fillRect(tx-4,ty-12,8,4);
    ctx.fillRect(tx-2,ty-8,4,10);
    ctx.globalAlpha=1;
  });

  // Floor — stone tiles with depth
  const floorGrad=ctx.createLinearGradient(0,floorY,0,h);
  floorGrad.addColorStop(0,th.floor1);
  floorGrad.addColorStop(1,th.floor2);
  ctx.fillStyle=floorGrad;
  ctx.fillRect(0,floorY,w,floorH);

  // Tile grid on floor
  ctx.globalAlpha=0.2;
  ctx.fillStyle=th.accent;
  const tileW=Math.floor(w/14);
  for(let i=0;i<=14;i++){
    ctx.fillRect(i*tileW,floorY,1,floorH);
  }
  ctx.fillRect(0,floorY,w,1);
  ctx.fillRect(0,floorY+floorH/2,w,1);
  ctx.globalAlpha=1;

  // Floor edge highlight
  ctx.globalAlpha=0.3;
  ctx.fillStyle=th.accent;
  ctx.fillRect(0,floorY,w,2);
  ctx.globalAlpha=1;

  // Vignette edges
  const vigL=ctx.createLinearGradient(0,0,w*0.12,0);
  vigL.addColorStop(0,'rgba(0,0,0,0.7)');
  vigL.addColorStop(1,'transparent');
  ctx.fillStyle=vigL; ctx.fillRect(0,0,w*0.12,h);
  const vigR=ctx.createLinearGradient(w,0,w*0.88,0);
  vigR.addColorStop(0,'rgba(0,0,0,0.7)');
  vigR.addColorStop(1,'transparent');
  ctx.fillStyle=vigR; ctx.fillRect(w*0.88,0,w*0.12,h);
}

window.addEventListener('resize',()=>{
  const c=document.getElementById('game-canvas');
  if(c&&G.running){c.width=AW();c.height=AH();}
});

// ============================================================
// NAME ENTRY MODAL
// ============================================================
let _nameModalCallback=null;
function showNameModal(callback){
  _nameModalCallback=callback;
  const modal=document.getElementById('name-modal');
  const input=document.getElementById('name-input');
  modal.classList.add('show');
  if(input){ input.value=''; setTimeout(()=>input.focus(),100); }
  // Submit on Enter key
  if(input) input.onkeydown=(e)=>{ if(e.key==='Enter') submitLeaderboardName(); };
}

function submitLeaderboardName(){
  const input=document.getElementById('name-input');
  const name=(input?input.value.trim():'').toUpperCase()||'UNKINDLED';
  document.getElementById('name-modal').classList.remove('show');
  if(_pendingLbEntry){
    lbSaveEntry({..._pendingLbEntry, name});
    _pendingLbEntry=null;
  }
  if(_nameModalCallback){ _nameModalCallback(); _nameModalCallback=null; }
}

// ============================================================
// ACHIEVEMENTS SYSTEM
// ============================================================
const ACHIEVEMENTS=[
  {id:'first_blood',    icon:'🩸', name:'FIRST BLOOD',      desc:'Defeat your first boss'},
  {id:'speed_demon',    icon:'⚡', name:'SPEED DEMON',       desc:'Kill a boss in under 30 seconds'},
  {id:'no_estus',       icon:'⚱', name:'HOLLOWED',          desc:'Defeat a boss without drinking Estus'},
  {id:'parry_master',   icon:'🛡', name:'PARRY MASTER',      desc:'Land a successful Parry & Riposte'},
  {id:'boss_rush',      icon:'💀', name:'THE GAUNTLET',      desc:'Complete Boss Rush mode'},
  {id:'all_bosses',     icon:'👑', name:'ASHEN ONE',         desc:'Defeat all 32 bosses'},
  {id:'ng_plus',        icon:'🌑', name:'CYCLE BEARER',      desc:'Enter New Game+'},
  {id:'greatsword_user',icon:'⚔',  name:'STRENGTH BUILD',    desc:'Defeat a boss with the Greatsword'},
  {id:'katana_user',    icon:'🗡', name:'WAY OF THE BLADE',  desc:'Defeat a boss with the Katana'},
  {id:'spear_user',     icon:'🔱', name:'PHALANX',           desc:'Defeat a boss with the Spear'},
  {id:'scythe_user',    icon:'🌙', name:'DEATH INCARNATE',   desc:'Defeat a boss with the Scythe'},
  {id:'twinblades_user',icon:'⚡', name:'BLEED BUILD',       desc:'Defeat a boss with Twin Blades'},
  {id:'crossbow_user',  icon:'🎯', name:'SNIPER\'S CREED',   desc:'Defeat a boss with the Crossbow'},
  {id:'halberd_user',   icon:'🪓', name:'IRON POISE',        desc:'Defeat a boss with the Halberd'},
  {id:'souls_hoarder',  icon:'💰', name:'SOULS HOARDER',     desc:'Accumulate 50,000 total souls'},
  {id:'coop_slayer',    icon:'👬', name:'JOLLY COOPERATION', desc:'Defeat 5 bosses in 2P co-op'},
  {id:'rebirth1',       icon:'✨', name:'BORN ANEW',         desc:'Complete your first Rebirth'},
];

function checkAchievements(){
  const toUnlock=[];
  if(defeatedBosses.length>=1) toUnlock.push('first_blood');
  if(defeatedBosses.length>=BOSSES.length) toUnlock.push('all_bosses');
  if(ngPlus>=1) toUnlock.push('ng_plus');
  if(rebirthCount>=1) toUnlock.push('rebirth1');
  if(totalSouls>=50000) toUnlock.push('souls_hoarder');
  if(_pendingLbEntry){
    if(_pendingLbEntry.time<=30) toUnlock.push('speed_demon');
    if(_pendingLbEntry.weapon==='greatsword') toUnlock.push('greatsword_user');
    if(_pendingLbEntry.weapon==='katana') toUnlock.push('katana_user');
    if(_pendingLbEntry.weapon==='spear') toUnlock.push('spear_user');
    if(_pendingLbEntry.weapon==='scythe') toUnlock.push('scythe_user');
    if(_pendingLbEntry.weapon==='twinblades') toUnlock.push('twinblades_user');
    if(_pendingLbEntry.weapon==='crossbow') toUnlock.push('crossbow_user');
    if(_pendingLbEntry.weapon==='halberd') toUnlock.push('halberd_user');
  }
  // Check co-op kills in leaderboard (use local cache to avoid async)
  const coopKills=lbLoadLocal().filter(e=>e.mode==='2p').length;
  if(coopKills>=5) toUnlock.push('coop_slayer');

  let anyNew=false;
  toUnlock.forEach(id=>{
    if(!unlockedAchievements.includes(id)){
      unlockedAchievements.push(id);
      anyNew=true;
      const ach=ACHIEVEMENTS.find(a=>a.id===id);
      if(ach) setTimeout(()=>showAchievementToast(ach),anyNew?800:2000);
    }
  });
}

function unlockAchievement(id){
  if(unlockedAchievements.includes(id)) return;
  unlockedAchievements.push(id);
  const ach=ACHIEVEMENTS.find(a=>a.id===id);
  if(ach) showAchievementToast(ach);
  saveGame();
}

let _achToastTimer=null;
function showAchievementToast(ach){
  const toast=document.getElementById('ach-toast');
  const icon=document.getElementById('ach-icon');
  const name=document.getElementById('ach-name');
  if(!toast) return;
  icon.textContent=ach.icon;
  name.textContent=ach.name;
  toast.classList.add('show');
  clearTimeout(_achToastTimer);
  _achToastTimer=setTimeout(()=>toast.classList.remove('show'),3200);
}

function showAchievements(){
  const grid=document.getElementById('ach-grid');
  grid.innerHTML='';
  ACHIEVEMENTS.forEach(ach=>{
    const card=document.createElement('div');
    const unlocked=unlockedAchievements.includes(ach.id);
    card.className='ach-card'+(unlocked?' unlocked':'');
    card.innerHTML=`<div class="ach-card-icon">${ach.icon}</div><div class="ach-card-name">${ach.name}</div><div class="ach-card-desc">${unlocked?ach.desc:'???'}</div>`;
    grid.appendChild(card);
  });
  showScreen('screen-achievements');
}

// ============================================================
// BOSS RUSH MODE
// ============================================================
function startBossRush(){
  bossRushMode=true;
  bossRushIndex=0;
  bossRushSouls=0;
  bossRushStartTime=Date.now();
  gameMode='1p';
  currentBoss=BOSSES[0];
  showScreen('screen-intro');
  document.getElementById('boss-name-display').textContent=currentBoss.name;
  document.getElementById('boss-subtitle').textContent=`BOSS RUSH — 1 / ${BOSSES.length}`;
  document.getElementById('boss-lore').textContent='The gauntlet begins. All 29 lords await your challenge.';
}

function startNextRushBoss(){
  currentBoss=BOSSES[bossRushIndex];
  if(!currentBoss){ bossRushMode=false; return; }
  updateRushHUD();
  startBossFight();
}

function updateRushHUD(){
  const hud=document.getElementById('rush-hud');
  if(!hud) return;
  hud.style.display=(bossRushMode||survivalMode)?'block':'none';
  if(bossRushMode) hud.textContent=`RUSH ${bossRushIndex+1}/${BOSSES.length} · ${bossRushSouls.toLocaleString()} SOULS`;
  if(survivalMode) hud.textContent=`WAVE ${survivalWave} · ${survivalSouls.toLocaleString()} SOULS · BEST: ${survivalBest}`;
}

// ============================================================
// SURVIVAL MODE — endless escalating waves
// ============================================================
let survivalMode=false;
let survivalWave=0;
let survivalSouls=0;
let survivalBest=0;
let survivalStartTime=0;

function startSurvivalMode(){
  survivalMode=true;
  survivalWave=0;
  survivalSouls=0;
  survivalStartTime=Date.now();
  gameMode='1p';
  // Load best from localStorage
  try{ survivalBest=parseInt(localStorage.getItem('darkpixels_survival_best')||'0'); }catch(e){}
  nextSurvivalWave();
}

function nextSurvivalWave(){
  survivalWave++;
  // Pick a boss — cycle through BOSSES, wrapping and scaling difficulty
  const idx=(survivalWave-1)%BOSSES.length;
  const scaledBoss={...BOSSES[idx]};
  const scale=1+Math.floor((survivalWave-1)/BOSSES.length)*0.5+(survivalWave-1)*0.05;
  scaledBoss.hp=Math.floor(scaledBoss.hp*scale);
  scaledBoss.atk=Math.floor(scaledBoss.atk*scale);
  scaledBoss.souls=Math.floor(scaledBoss.souls*(1+survivalWave*0.1));
  currentBoss=scaledBoss;
  showScreen('screen-intro');
  document.getElementById('boss-name-display').textContent=scaledBoss.name;
  document.getElementById('boss-subtitle').textContent=`SURVIVAL — WAVE ${survivalWave}`;
  document.getElementById('boss-lore').textContent=
    survivalWave===1?'The endless gauntlet begins. Survive as long as you can.':
    `Wave ${survivalWave} — enemies grow stronger with each fallen lord.`;
  updateRushHUD();
}

function endSurvivalRun(){
  survivalMode=false;
  if(survivalWave-1>survivalBest){
    survivalBest=survivalWave-1;
    try{ localStorage.setItem('darkpixels_survival_best',survivalBest); }catch(e){}
  }
  lbSaveEntry({boss:`SURVIVAL WAVE ${survivalWave-1}`,bossId:'survival',
    time:Math.floor((Date.now()-survivalStartTime)/1000),
    souls:survivalSouls,mode:'survival',weapon:equippedWeapon,rebirth:rebirthCount,
    date:new Date().toLocaleDateString()});
  showScreen('screen-defeat');
}

// ============================================================
// SPEED RUN MODE — timed, no shrine access
// ============================================================
let speedRunMode=false;
let speedRunTimer=0;
let speedRunInterval=null;
let speedRunBossIndex=0;
let speedRunSouls=0;

function startSpeedRun(){
  speedRunMode=true;
  speedRunBossIndex=0;
  speedRunSouls=0;
  speedRunTimer=0;
  gameMode='1p';
  // No upgrades — reset to base
  upgrades={hp:0,damage:0,estus:0,defense:0,stamina:0,
    sword:1,mace:0,bow:0,wand:0,katana:0,greatsword:0,spear:0,
    scythe:0,twinblades:0,crossbow:0,halberd:0,flail:0,dagger:0,rapier:0,waraxe:0,
    swordDmg:0,maceDmg:0,bowDmg:0,wandPow:0,katanaDmg:0,gswordDmg:0,spearDmg:0,
    scytheDmg:0,twinbladesDmg:0,crossbowDmg:0,halberdDmg:0,flailDmg:0,daggerDmg:0,rapierDmg:0,waraxeDmg:0,
    soul_arrow:0,fireball:0,heal_spell:0,dark_orb:0,lightning:0,magic:0};
  clearInterval(speedRunInterval);
  speedRunInterval=setInterval(()=>{
    if(!speedRunMode){ clearInterval(speedRunInterval); return; }
    speedRunTimer++;
    const hud=document.getElementById('rush-hud');
    if(hud) hud.textContent=`SPEED RUN · ${lbFormatTime(speedRunTimer)} · ${speedRunBossIndex}/${BOSSES.length} BOSSES`;
  },1000);
  currentBoss=BOSSES[0];
  showScreen('screen-intro');
  document.getElementById('boss-name-display').textContent=currentBoss.name;
  document.getElementById('boss-subtitle').textContent=`SPEED RUN — BOSS 1 / ${BOSSES.length}`;
  document.getElementById('boss-lore').textContent='No shrine. No upgrades. Just skill. Go.';
  const hud=document.getElementById('rush-hud');
  if(hud){ hud.style.display='block'; hud.textContent=`SPEED RUN · 0:00 · 0/${BOSSES.length} BOSSES`; }
}

function nextSpeedRunBoss(){
  speedRunBossIndex++;
  if(speedRunBossIndex>=BOSSES.length){
    // Finished!
    clearInterval(speedRunInterval);
    speedRunMode=false;
    lbSaveEntry({boss:'SPEED RUN COMPLETE',bossId:'speedrun',
      time:speedRunTimer,souls:speedRunSouls,mode:'speedrun',
      weapon:equippedWeapon,rebirth:rebirthCount,date:new Date().toLocaleDateString()});
    showScreen('screen-victory');
    document.getElementById('victory-reward').textContent=
      `SPEED RUN COMPLETE!\nTime: ${lbFormatTime(speedRunTimer)}\n+${speedRunSouls.toLocaleString()} SOULS`;
    return;
  }
  currentBoss=BOSSES[speedRunBossIndex];
  const hud=document.getElementById('rush-hud');
  if(hud) hud.style.display='block';
  startBossFight();
}

// ============================================================
// RANDOM BOSS MODE
// ============================================================
function startRandomBoss(){
  gameMode='1p';
  const unbeaten=BOSSES.filter(b=>!defeatedBosses.includes(b.id));
  const pool=unbeaten.length>0?unbeaten:BOSSES;
  currentBoss=pool[Math.floor(Math.random()*pool.length)];
  showScreen('screen-intro');
  document.getElementById('boss-name-display').textContent=currentBoss.name;
  document.getElementById('boss-subtitle').textContent='RANDOM ENCOUNTER';
  document.getElementById('boss-lore').textContent='Fate has chosen your opponent. Steel yourself, Unkindled.';
}
function activateNGPlus(){
  ngPlus++;
  defeatedBosses=[];
  // Keep upgrades but reset souls partially
  totalSouls=Math.floor(totalSouls*0.5);
  updateSoulsDisplay();
  // Show NG+ badge
  const badge=document.getElementById('ngplus-badge');
  if(badge){ badge.style.display='block'; document.getElementById('ngplus-num').textContent=ngPlus; }
  unlockAchievement('ng_plus');
  buildBossList();
  showScreen('screen-select');
  showNotification(`🌑 NEW GAME+ ${ngPlus} ACTIVE — Bosses are stronger!`,3500);
  saveGame();
}

// ============================================================
// LEADERBOARD  (shared via JSONBin.io — falls back to localStorage)
// ============================================================
const LB_KEY = 'darkpixels_leaderboard';
const LB_MAX = 100;

// ── PASTE YOUR JSONBIN BIN ID AND API KEY BELOW ──
// 1. Go to https://jsonbin.io  →  sign up free
// 2. Create BIN 1 (Leaderboard):  paste {"entries":[]}  →  Public  →  Save
// 3. Create BIN 2 (Global Souls): paste {"totalSouls":0} →  Public  →  Save
// 4. Go to API Keys tab → create a key → copy it
// 5. Paste all three values below and redeploy to Netlify
const JSONBIN_BIN_ID       = '699f557dd0ea881f40d95216';
const JSONBIN_SOULS_BIN_ID = '699f556843b1c97be99de91d';
const JSONBIN_API_KEY      = '$2a$10$ju7vu1AlhqlTehKPP4iPH.4B84/0.TXQ/hiZqj4I6J3iosiPtmBTy';
const JSONBIN_URL          = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
const JSONBIN_SOULS_URL    = `https://api.jsonbin.io/v3/b/${JSONBIN_SOULS_BIN_ID}`;
const JSONBIN_CONFIGURED   = JSONBIN_BIN_ID !== 'PASTE_LEADERBOARD_BIN_ID_HERE';

// ── Global souls counter ──
let _globalSoulsCache = null;

async function fetchGlobalSouls(){
  if(!JSONBIN_CONFIGURED) return 0;
  try{
    const res = await fetch(JSONBIN_SOULS_URL+'/latest',{
      headers:{'X-Master-Key':JSONBIN_API_KEY,'X-Bin-Meta':'false'}
    });
    if(!res.ok) return 0;
    const d = await res.json();
    return typeof d.totalSouls==='number' ? d.totalSouls : (typeof d.entries==='undefined'?0:0);
  }catch(e){ return 0; }
}

async function addToGlobalSouls(amount){
  if(!JSONBIN_CONFIGURED||amount<=0) return;
  try{
    const current = await fetchGlobalSouls();
    const newTotal = current + amount;
    _globalSoulsCache = newTotal;
    await fetch(JSONBIN_SOULS_URL,{
      method:'PUT',
      headers:{'Content-Type':'application/json','X-Master-Key':JSONBIN_API_KEY,'X-Bin-Meta':'false'},
      body: JSON.stringify({totalSouls: newTotal})
    });
    // Update display if visible
    const el = document.getElementById('global-souls-count');
    if(el) el.textContent = newTotal.toLocaleString();
  }catch(e){}
}

let _lbCache = null;          // in-memory cache of fetched entries
let _lbFetching = false;      // debounce flag
let _lbLastFetch = 0;         // timestamp of last successful fetch

// ── Local fallback ──
function lbLoadLocal(){
  try{ return JSON.parse(localStorage.getItem(LB_KEY)||'[]'); }catch(e){ return []; }
}
function lbSaveLocal(entries){
  try{ localStorage.setItem(LB_KEY, JSON.stringify(entries)); }catch(e){}
}

// ── Fetch shared leaderboard from JSONBin ──
async function lbFetchRemote(){
  if(!JSONBIN_CONFIGURED) return null;
  try{
    const res = await fetch(JSONBIN_URL+'/latest', {
      headers:{'X-Master-Key': JSONBIN_API_KEY, 'X-Bin-Meta': 'false'}
    });
    if(!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.entries) ? data.entries : [];
  }catch(e){ return null; }
}

// ── Push entries to JSONBin ──
async function lbPushRemote(entries){
  if(!JSONBIN_CONFIGURED) return;
  try{
    await fetch(JSONBIN_URL, {
      method:'PUT',
      headers:{
        'Content-Type':'application/json',
        'X-Master-Key': JSONBIN_API_KEY,
        'X-Bin-Meta': 'false'
      },
      body: JSON.stringify({entries})
    });
  }catch(e){}
}

// ── Load entries (remote preferred, local fallback) ──
async function lbLoad(){
  // Use cache if fresh (< 30 seconds old)
  if(_lbCache && Date.now()-_lbLastFetch < 30000) return _lbCache;
  const remote = await lbFetchRemote();
  if(remote !== null){
    // Merge with local so offline entries aren't lost
    const local = lbLoadLocal();
    const merged = mergeLeaderboards(remote, local);
    _lbCache = merged;
    _lbLastFetch = Date.now();
    lbSaveLocal(merged); // keep local in sync
    return merged;
  }
  // Fallback to local
  return lbLoadLocal();
}

// ── Merge two entry arrays, deduplicate by boss+name+date, keep top LB_MAX ──
function mergeLeaderboards(a, b){
  const seen = new Set();
  const merged = [];
  for(const e of [...a, ...b]){
    const key = `${e.boss}|${e.name||''}|${e.date}|${e.time}`;
    if(!seen.has(key)){ seen.add(key); merged.push(e); }
  }
  return merged.slice(0, LB_MAX);
}

// ── Save a new entry (local immediately, push to remote async) ──
async function lbSaveEntry(entry){
  // Save locally right away so it shows up instantly
  const local = lbLoadLocal();
  local.unshift(entry);
  if(local.length > LB_MAX) local.length = LB_MAX;
  lbSaveLocal(local);
  _lbCache = null; // invalidate cache

  if(!JSONBIN_CONFIGURED) return;
  // Fetch current remote, merge, push back
  const remote = await lbFetchRemote();
  const base = remote !== null ? remote : local;
  const merged = mergeLeaderboards([entry, ...base], []);
  await lbPushRemote(merged);
  _lbCache = merged;
  _lbLastFetch = Date.now();
  lbSaveLocal(merged);
}

function lbFormatTime(s){
  const m = Math.floor(s/60);
  const sec = s%60;
  return m>0 ? `${m}m ${sec}s` : `${sec}s`;
}

function showLeaderboard(){
  _lbFromScreen = document.querySelector('.screen.active')?.id || 'screen-title';
  _lbFilter = 'all';
  document.querySelectorAll('.lb-filter-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.lb-filter-btn')?.classList.add('active');
  renderLeaderboard();
  showScreen('screen-leaderboard');
  // Fetch and display global souls
  const el = document.getElementById('global-souls-count');
  if(el){
    if(!JSONBIN_CONFIGURED){ el.textContent='(local only)'; }
    else if(_globalSoulsCache!==null){ el.textContent=_globalSoulsCache.toLocaleString(); }
    else{ el.textContent='⏳'; fetchGlobalSouls().then(n=>{ _globalSoulsCache=n; el.textContent=n.toLocaleString(); }); }
  }
}

function lbGoBack(){
  showScreen(_lbFromScreen);
}

function lbSetFilter(filter, btn){
  _lbFilter = filter;
  document.querySelectorAll('.lb-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderLeaderboard();
}

function renderLeaderboard(){
  const tbody = document.getElementById('lb-tbody');
  // Show loading state
  tbody.innerHTML = `<tr><td colspan="9" class="lb-empty" id="lb-loading">
    ${JSONBIN_CONFIGURED ? '⏳ LOADING GLOBAL BOARD...' : '⚠ JSONBIN NOT CONFIGURED — SHOWING LOCAL ONLY<br><br><span style="font-size:5px;color:#555">See code comments to enable shared leaderboard</span>'}
  </td></tr>`;

  lbLoad().then(allEntries => {
    let entries = [...allEntries];
    if(_lbFilter === 'fastest'){
      entries = entries.sort((a,b)=>a.time-b.time).slice(0,20);
    } else if(_lbFilter === 'souls'){
      entries = entries.sort((a,b)=>b.souls-a.souls).slice(0,20);
    } else if(_lbFilter === '2p'){
      entries = entries.filter(e=>e.mode==='2p');
    } else if(_lbFilter === 'rush'){
      entries = entries.filter(e=>e.mode==='rush');
    }

    tbody.innerHTML = '';

    // Show shared/local badge
    const statusRow = document.createElement('tr');
    statusRow.innerHTML = `<td colspan="9" style="text-align:center;font-size:5px;padding:4px 0;color:${JSONBIN_CONFIGURED?'#3a6a2a':'#554400'};">
      ${JSONBIN_CONFIGURED ? '🌐 GLOBAL LEADERBOARD — SHARED ACROSS ALL PLAYERS' : '💾 LOCAL LEADERBOARD — configure JSONBin to share globally'}
    </td>`;
    tbody.appendChild(statusRow);

    if(entries.length === 0){
      const empty = document.createElement('tr');
      empty.innerHTML = `<td colspan="9" class="lb-empty">NO RECORDS YET<br><br>DEFEAT A BOSS TO LIGHT THIS BOARD</td>`;
      tbody.appendChild(empty);
      return;
    }

    entries.forEach((e,i)=>{
      const tr = document.createElement('tr');
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      const rowClass = i===0?'gold-row':i===1?'silver-row':i===2?'bronze-row':'';
      if(rowClass) tr.className = rowClass;
      const wIcons={sword:'⚔',mace:'🔨',bow:'🏹',wand:'🪄',katana:'🗡️',greatsword:'⚔',spear:'🔱',scythe:'🌙',twinblades:'⚡',crossbow:'🎯',halberd:'🪓',flail:'⛓',dagger:'🔪',rapier:'🤺',waraxe:'🪓'};
      const rebirthStr = e.rebirth>0?`✨×${e.rebirth}`:'—';
      const playerName = e.name||'UNKINDLED';
      const modeTag = e.mode==='2p'?'<span style="color:var(--p2)">2P</span>'
        :e.mode==='rush'?'<span style="color:var(--magic)">RUSH</span>'
        :e.mode==='survival'?'<span style="color:#ff6622">SURV</span>'
        :e.mode==='speedrun'?'<span style="color:#44ddff">SPEED</span>'
        :'<span style="color:var(--p1)">1P</span>';
      tr.innerHTML = `
        <td class="lb-rank">${medal||'#'+(i+1)}</td>
        <td style="color:var(--frost);font-size:clamp(4px,.6vw,6px)">${playerName}</td>
        <td class="lb-boss-name">${e.boss||'???'}</td>
        <td class="lb-time">${lbFormatTime(e.time||0)}</td>
        <td class="lb-souls">💀 ${(e.souls||0).toLocaleString()}</td>
        <td>${modeTag}</td>
        <td>${wIcons[e.weapon]||'⚔'} ${(e.weapon||'sword').toUpperCase()}</td>
        <td style="color:var(--magic)">${rebirthStr}</td>
        <td style="color:#444">${e.date||'—'}</td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function lbClearConfirm(){
  if(confirm('CLEAR ALL LEADERBOARD RECORDS?\n\nThis cannot be undone.')){
    lbSaveLocal([]);
    _lbCache = [];
    if(JSONBIN_CONFIGURED) lbPushRemote([]);
    renderLeaderboard();
    showNotification('🗑 Leaderboard cleared.');
  }
}

// ============================================================
// KEYBIND SETTINGS
// ============================================================
let _kbFromScreen='screen-title';
let _kbListening=null; // {player,action,btn}

function showKeybinds(){
  _kbFromScreen=document.querySelector('.screen.active')?.id||'screen-title';
  refreshKeybindUI();
  showScreen('screen-keybinds');
}

function refreshKeybindUI(){
  const actionLabels={left:'left',right:'right',jump:'jump',roll:'roll',attack:'attack',magic:'magic',heal:'heal',block:'block'};
  Object.keys(actionLabels).forEach(action=>{
    const b1=document.getElementById('kb1-'+action);
    const b2=document.getElementById('kb2-'+action);
    if(b1) b1.textContent=formatKey(keybinds1[action]);
    if(b2) b2.textContent=formatKey(keybinds2[action]);
  });
  updateControlsBar();
}

function formatKey(k){
  if(!k) return '?';
  const map={' ':'SPC',arrowleft:'←',arrowright:'→',arrowup:'↑',arrowdown:'↓',escape:'ESC',enter:'ENT',backspace:'BKSP',tab:'TAB',shift:'SHIFT',control:'CTRL',alt:'ALT'};
  return (map[k]||k).toUpperCase();
}

function startRebind(player,action,btn){
  // Cancel any existing listener
  if(_kbListening){
    _kbListening.btn.classList.remove('listening');
    _kbListening.btn.textContent=formatKey((player==='p1'?keybinds1:keybinds2)[_kbListening.action]);
  }
  _kbListening={player,action,btn};
  btn.textContent='...';
  btn.classList.add('listening');

  const handler=(e)=>{
    e.preventDefault();
    e.stopPropagation();
    if(e.key==='Escape'){ cancelRebind(); return; }
    const newKey=e.key.toLowerCase();

    // Conflict detection: warn if the other player already uses this key
    const otherBinds = player==='p1' ? keybinds2 : keybinds1;
    const conflictAction = Object.entries(otherBinds).find(([a,k])=>k===newKey);
    if(conflictAction){
      const label = document.querySelector(`#kb${player==='p1'?'2':'1'}-${conflictAction[0]}`);
      if(label) label.style.borderColor='#ff4422';
      setTimeout(()=>{ if(label) label.style.borderColor=''; }, 2500);
      showNotification(`⚠ KEY CONFLICT: "${newKey.toUpperCase()}" already used by ${player==='p1'?'P2':'P1'} (${conflictAction[0].toUpperCase()}). Binding anyway.`, 3000);
    }

    if(player==='p1') keybinds1[action]=newKey;
    else              keybinds2[action]=newKey;
    btn.classList.remove('listening');
    _kbListening=null;
    saveKeybinds();
    refreshKeybindUI();
    window.removeEventListener('keydown',handler,true);
  };
  window.addEventListener('keydown',handler,true);
}

function cancelRebind(){
  if(!_kbListening) return;
  _kbListening.btn.classList.remove('listening');
  refreshKeybindUI();
  _kbListening=null;
}

function resetKeybinds(){
  keybinds1={...DEFAULT_BINDS_P1};
  keybinds2={...DEFAULT_BINDS_P2};
  saveKeybinds();
  refreshKeybindUI();
  showNotification('⌨ Keybinds reset to defaults.');
}

function updateControlsBar(){
  // P1 hints
  const p1map={
    'kb-move':   `${formatKey(keybinds1.left)}/${formatKey(keybinds1.right)}`,
    'kb-jump':   formatKey(keybinds1.jump),
    'kb-roll':   formatKey(keybinds1.roll),
    'kb-attack': formatKey(keybinds1.attack),
    'kb-magic':  formatKey(keybinds1.magic),
    'kb-heal':   formatKey(keybinds1.heal),
    'kb-block':  formatKey(keybinds1.block),
  };
  const p2map={
    'kb2-move':   `${formatKey(keybinds2.left)}/${formatKey(keybinds2.right)}`,
    'kb2-jump':   formatKey(keybinds2.jump),
    'kb2-roll':   formatKey(keybinds2.roll),
    'kb2-attack': formatKey(keybinds2.attack),
    'kb2-magic':  formatKey(keybinds2.magic),
    'kb2-heal':   formatKey(keybinds2.heal),
    'kb2-block':  formatKey(keybinds2.block),
  };
  Object.entries(p1map).forEach(([id,v])=>{ const el=document.getElementById(id); if(el) el.textContent=v; });
  Object.entries(p2map).forEach(([id,v])=>{ const el=document.getElementById(id); if(el) el.textContent=v; });
}

// Initialize
setupCornerTriggers();
loadKeybinds();
// Load saved game data
if(loadGame()){
  if(ngPlus>0){
    const badge=document.getElementById('ngplus-badge');
    if(badge){ badge.style.display='block'; document.getElementById('ngplus-num').textContent=ngPlus; }
  }
}
updateSaveIndicator();
showScreen('screen-title');

// Menu button click sounds (audio context requires user interaction)
document.addEventListener('click', e=>{
  if(e.target.closest('.btn') || e.target.closest('.boss-card') || e.target.closest('.mode-card')){
    SFX.menuClick();
  }
}, true);

