document.addEventListener('DOMContentLoaded', ()=>{
  const LEFT_COUNT = 32;
  const RIGHT_COUNT = 32;
  const left = document.querySelector('.edge.left');
  const right = document.querySelector('.edge.right');

  function rand(min,max){return Math.random()*(max-min)+min}

  function makeParticle(side){
    const el = document.createElement('span');
    el.className = 'particle';
    const size = Math.round(rand(4,18));
    el.style.width = size+'px';
    el.style.height = size+'px';

    // color palette: warm golds and white
    el.style.background = Math.random() < 0.17 ? '#ffffff' : 'rgba(185,135,60,'+rand(0.6,1)+')';

    // vertical position along the edge
    el.style.top = rand(2,96)+'%';

    // horizontal anchor: left edge particles start at left:6% of that edge, right at right
    if(side==='left'){
      el.style.left = rand(2,28)+'%';
      el.style.setProperty('--tx', rand(14,110)+'px');
    } else {
      el.style.left = rand(68,98)+'%';
      el.style.setProperty('--tx', -rand(14,110)+'px');
    }

    // vertical bob amount
    const ty = (Math.random()<0.5? -1:1)*rand(6,78);
    el.style.setProperty('--ty', Math.round(ty)+'px');

    // random animation duration & delay (slower for gentler motion)
    el.style.setProperty('--dur', rand(14,36)+'s');
    el.style.setProperty('--delay', rand(0,6)+'s');

    return el;
  }

  for(let i=0;i<LEFT_COUNT;i++) left.appendChild(makeParticle('left'));
  for(let i=0;i<RIGHT_COUNT;i++) right.appendChild(makeParticle('right'));

  // optional: small pulse on button when clicked
  const cta = document.querySelector('.cta');
  const overlay = document.getElementById('overlay');
  const topParticles = document.getElementById('topParticles');
  const close = document.getElementById('closeOverlay');
  const cakeWrap = document.getElementById('cakeWrap');
  const blowBtn = document.getElementById('blowBtn');
  const cakeImg = document.getElementById('cakeImg');
  const message = document.querySelector('.message');
  let cakeTimer = null;
  let audioStream = null;
  let audioContext = null;
  let meterInterval = null;
  // background ambience audio context and nodes
  let bgCtx = null;
  let bgMaster = null;
  let bgNodes = [];
  const cakeSvg = document.getElementById('cakeSvg');
  const flames = cakeSvg ? cakeSvg.querySelectorAll('.flame') : [];
  let blown = false;
  let spokenOnClick = false;

  // Image list pulled from image/ folder (15 images expected)
  const IMAGE_LIST = [
    'image/p1.jpg','image/p2.jpg','image/p3.jpg','image/p4.jpg','image/p5.jpg',
    'image/p6.jpg','image/p7.jpg','image/p8.jpg','image/p9.jpg','image/p10.jpg',
    'image/p11.jpg','image/p12.jpg','image/p13.jpg','image/p14.jpg','image/p15.jpg'
  ];

  function makeTopParticle(){
    const el = document.createElement('span');
    el.className = 'tp';
    const size = Math.round(rand(2,8));
    el.style.width = size+'px';
    el.style.height = size+'px';
    el.style.left = rand(0,98)+'%';
    el.style.background = Math.random() < 0.12 ? '#ffffff' : 'rgba(185,135,60,'+rand(0.6,1)+')';
    // much slower fall so particles drift gently to bottom
    el.style.setProperty('--dur', rand(18,48)+'s');
    el.style.setProperty('--delay', rand(0,4.2)+'s');
    topParticles.appendChild(el);

    // remove when CSS animation ends to keep emission continuous
    const removeOnEnd = () => {
      el.removeEventListener('animationend', removeOnEnd);
      if(el.parentNode) el.parentNode.removeChild(el);
    };
    el.addEventListener('animationend', removeOnEnd);
    return el;
  }

  function populateTop(count){
    topParticles.innerHTML = '';
    for(let i=0;i<count;i++) makeTopParticle();
  }

  // continuous emitter while overlay is visible
  let topEmitter = null;
  function startTopEmitter(ms){
    stopTopEmitter();
    topEmitter = setInterval(()=>{
      const batch = Math.random() < 0.25 ? 3 : 1;
      for(let i=0;i<batch;i++) makeTopParticle();
    }, ms);
  }
  function stopTopEmitter(){ if(topEmitter){ clearInterval(topEmitter); topEmitter = null } }

  cta.addEventListener('click',()=>{
    // pulse the button
    cta.animate([
      {transform:'scale(1)'},
      {transform:'scale(0.96)'},
      {transform:'scale(1)'}
    ],{duration:220,easing:'ease-out'});

    // show overlay and populate particles
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden','false');
    populateTop(80);
    startTopEmitter(420);
    if(cta) cta.classList.add('hidden');

    // start a soft ambient background sound (user gesture required)
    try{ startBackgroundAmbience(); }catch(e){ /* ignore */ }

    // speak greeting immediately on click (user gesture) and mark so we don't repeat
    try{ speakText('happy birthday to you allurabels', {male:true}); spokenOnClick = true; }catch(e){}

    // schedule cake to appear after 60 seconds
    if(cakeTimer) clearTimeout(cakeTimer);
    if(cakeWrap){
      cakeWrap.classList.remove('show','blown');
      cakeWrap.setAttribute('aria-hidden','true');
      cakeTimer = setTimeout(()=>{
        // speak the greeting here only if we haven't already spoken on click
        if(message && !spokenOnClick){ try{ speakText('happy birthday to you allurabels', {male:true}); }catch(e){} }
        // delay showing the cake until the spoken greeting finishes (~2200ms)
        setTimeout(()=>{
          cakeWrap.classList.add('show');
          cakeWrap.setAttribute('aria-hidden','false');
          // remove the greeting once the cake appears
          if(message){ try{ message.remove() }catch(e){} }
          // start flame flicker
          if(flames && flames.length) flames.forEach(f=> f.classList.add('flicker'));
          // play happy birthday melody
          try{ playHappyBirthday(); }catch(e){ /* ignore */ }
          // hide blow button until mic fallback needed
          if(blowBtn) blowBtn.style.display = 'none';
          // try to start mic listening; if denied, show the blow button as fallback
          startMicListening().catch(()=>{
            if(blowBtn){ blowBtn.style.display = 'inline-block'; document.querySelector('.blow-hint').textContent = 'Allow mic or press Blow'; }
          });
        }, 2200);
      }, 1000);
    }
  });

  close.addEventListener('click',()=>{
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden','true');
    stopTopEmitter();
    topParticles.innerHTML = '';
    if(cakeTimer){ clearTimeout(cakeTimer); cakeTimer = null }
    if(cakeWrap){ cakeWrap.classList.remove('show','blown'); cakeWrap.setAttribute('aria-hidden','true') }
    if(flames && flames.length) flames.forEach(f=> f.classList.remove('extinguished','flicker'));
    if(cta) cta.classList.remove('hidden');
    // reset spoken flag so next open can speak again
    spokenOnClick = false;
    // stop ambient audio when overlay closes
    try{ stopBackgroundAmbience(); }catch(e){}
  });

  // close when clicking outside the content
  overlay.addEventListener('click',(e)=>{
    if(e.target === overlay){
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden','true');
      stopTopEmitter();
      topParticles.innerHTML = '';
      if(cakeTimer){ clearTimeout(cakeTimer); cakeTimer = null }
      if(cakeWrap){ cakeWrap.classList.remove('show','blown'); cakeWrap.setAttribute('aria-hidden','true') }
      if(flames && flames.length) flames.forEach(f=> f.classList.remove('extinguished','flicker'));
      if(cta) cta.classList.remove('hidden');
      spokenOnClick = false;
      try{ stopBackgroundAmbience(); }catch(e){}
    }
  });

  // close with Escape key
  document.addEventListener('keydown',(e)=>{
    if(e.key === 'Escape' && overlay.classList.contains('show')){
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden','true');
      stopTopEmitter();
      topParticles.innerHTML = '';
      if(cakeTimer){ clearTimeout(cakeTimer); cakeTimer = null }
      if(cakeWrap){ cakeWrap.classList.remove('show','blown'); cakeWrap.setAttribute('aria-hidden','true') }
      if(flames && flames.length) flames.forEach(f=> f.classList.remove('extinguished','flicker'));
      if(cta) cta.classList.remove('hidden');
      spokenOnClick = false;
      try{ stopBackgroundAmbience(); }catch(e){}
    }
  });

  // blow interaction: show a puff and mark cake as blown
  // helper to perform the blow action
  function doBlow(){
    if(!cakeWrap || !cakeSvg) return;
    if(blown) return;
    blown = true;
    // add a single puff centered above the cake
    const puff = document.createElement('span');
    puff.className = 'puff';
    const rect = cakeSvg.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    puff.style.left = (rect.left + rect.width*0.5 - overlayRect.left) + 'px';
    puff.style.top = (rect.top + rect.height*0.18 - overlayRect.top) + 'px';
    overlay.appendChild(puff);
    puff.addEventListener('animationend', ()=> puff.remove());

    // extinguish each flame with a short stagger and force-hide
    flames.forEach((f, i)=>{
      // stop flicker/animation first
      f.classList.remove('flicker');
      f.style.animation = 'none';
      f.style.filter = 'none';
      // ensure CSS transition applies
      f.style.transition = 'opacity .6s ease, transform .6s ease';
      setTimeout(()=>{
        f.classList.add('extinguished');
        f.style.opacity = '0';
        f.style.transform = 'translateY(-8px) scale(0.5)';
      }, i*160);
      // after the fade, remove element to avoid lingering glow
      setTimeout(()=>{
        try{ f.remove(); }catch(e){ f.style.display='none' }
      }, i*160 + 700);
    });
    cakeWrap.classList.add('blown');
    stopMicListening();
    // show 15 framed pictures after blow
    setTimeout(()=>{
      showFrames(15);
    }, 900);
  }

  // simple Happy Birthday melody using WebAudio
  function playHappyBirthday(tempo=1){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [
        [392,1],[392,0.5],[440,1.5],[392,1.5],[523.25,1.5],[493.88,3],
        [392,1],[392,0.5],[440,1.5],[392,1.5],[587.33,1.5],[523.25,3],
        [392,1],[392,0.5],[783.99,1.5],[659.25,1.5],[523.25,1.5],[493.88,1.5],[440,3],
        [698.46,1],[698.46,0.5],[659.25,1.5],[523.25,1.5],[587.33,1.5],[523.25,3]
      ];
      const beat = 0.36 / tempo;
      let t = ctx.currentTime + 0.05;
      const gain = ctx.createGain(); gain.gain.value = 0.12; gain.connect(ctx.destination);
      notes.forEach(([freq,beats])=>{
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t);
        o.connect(gain);
        o.start(t);
        o.stop(t + beats * beat);
        t += beats * beat;
      });
    }catch(e){ console.warn('Audio not available', e) }
  }

  // text-to-speech helper (uses SpeechSynthesis)
  // opts: { male: true } -> attempt to pick a deeper/male-sounding voice and lower pitch
  function speakText(text, opts = {}){
    try{
      if(!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      // prefer a deeper voice when requested
      u.pitch = opts.male ? 0.7 : 1;
      u.rate = opts.male ? 0.95 : 1;
      u.volume = 1;

      // choose a likely male voice when available
      const voices = window.speechSynthesis.getVoices();
      if(voices && voices.length){
        // try to find voices whose name suggests a male voice
        const prefer = voices.find(v=>/male|david|jon|john|matt|mark|alex|ryan|tom|leo/i.test(v.name));
        if(prefer) u.voice = prefer;
        else {
          // fallback: prefer en voices
          const en = voices.find(v => /en(-|_)?/i.test(v.lang) || /english/i.test(v.name));
          if(en) u.voice = en;
        }
      }

      // cancel any existing speech then speak
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }catch(e){ console.warn('TTS not available', e) }
  }

  if(blowBtn){
    blowBtn.addEventListener('click', doBlow);
  }

  // allow mobile users to tap the hint to enable microphone explicitly
  const micHint = document.getElementById('micHint');
  if(micHint){
    micHint.addEventListener('click', async (e)=>{
      e.stopPropagation();
      micHint.textContent = 'Enabling mic...';
      try{
        await startMicListening();
        micHint.textContent = 'Mic enabled — blow gently';
        try{ navigator.vibrate && navigator.vibrate(50); }catch(e){}
      }catch(err){
        micHint.textContent = 'Mic not available — press Blow';
        if(blowBtn) blowBtn.style.display = 'inline-block';
      }
    });
  }

  // create and show framed placeholders (or real images if provided)
  function showFrames(n){
    // remove existing grid if any
    let grid = document.getElementById('photoGrid');
    if(grid) grid.remove();

    // remove cake and greeting so only frames remain
    try{ if(cakeWrap) cakeWrap.remove(); }catch(e){ if(cakeWrap) cakeWrap.style.display='none' }
    try{ if(message) message.remove(); }catch(e){ if(message) message.style.display='none' }

    grid = document.createElement('div');
    grid.id = 'photoGrid';
    grid.className = 'photo-grid';
    // prepare image urls from IMAGE_LIST; if n > available, wrap around
    const imgs = [];
    for(let k=0;k<n;k++) imgs.push( IMAGE_LIST[k % IMAGE_LIST.length] );

    for(let i=1;i<=n;i++){
      // build flip-card structure
      const card = document.createElement('div');
      card.className = 'flip-card';

      const inner = document.createElement('div');
      inner.className = 'flip-inner';

      // front: placeholder framed card (no image)
      const front = document.createElement('div');
      front.className = 'flip-front';
      const pfPlaceholder = document.createElement('div');
      pfPlaceholder.className = 'photo-frame placeholder';
      const labelFront = document.createElement('div'); labelFront.className = 'label'; labelFront.textContent = 'Frame '+i;
      pfPlaceholder.appendChild(labelFront);
      front.appendChild(pfPlaceholder);

      // back: actual framed image (revealed when flipped)
      const back = document.createElement('div');
      back.className = 'flip-back';
      const pfBack = document.createElement('div'); pfBack.className = 'photo-frame';
      const frameInnerBack = document.createElement('div'); frameInnerBack.className = 'frame-inner';
      const imgBoxBack = document.createElement('div'); imgBoxBack.className = 'frame-img';
      frameInnerBack.appendChild(imgBoxBack);
      pfBack.appendChild(frameInnerBack);
      back.appendChild(pfBack);

      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);

      // flip on click/tap
      card.addEventListener('click', (e)=>{
        card.classList.toggle('flipped');
      });

      grid.appendChild(card);
      // preload and set image on the back side
      (function(src, imgBoxElem){
        const img = new Image();
        img.onload = function(){
          imgBoxElem.style.backgroundImage = "url('"+src+"')";
          imgBoxElem.style.backgroundSize = 'cover';
          imgBoxElem.style.backgroundPosition = 'center';
          imgBoxElem.style.backgroundRepeat = 'no-repeat';
        };
        img.onerror = function(){ /* keep placeholder on back if failed */ };
        img.src = src;
      })(imgs[i-1], imgBoxBack);
    }
    // attach below the cakeWrap (or overlay content)
    const container = overlay.querySelector('.overlay-content') || overlay;
    container.appendChild(grid);
    // optional entrance animation
    grid.style.opacity = '0';
    grid.style.transform = 'translateY(8px)';
    requestAnimationFrame(()=>{
      grid.style.transition = 'opacity .5s ease, transform .5s ease';
      grid.style.opacity = '1';
      grid.style.transform = 'translateY(0)';
    });
  }

  // microphone listening: detect loud short bursts (blow)
  async function startMicListening(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('No mic');

    // prefer looser processing on mobile: disable echo/noise suppression so we can detect wind
    const constraints = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };

    // ensure audio context is created/resumed from a user gesture (important on mobile)
    if(!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try{ if(audioContext.state === 'suspended') await audioContext.resume(); }catch(e){}

    audioStream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = audioContext.createMediaStreamSource(audioStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    // measure RMS and peak and trigger blow on a sharp burst
    const RMS_THRESHOLD = 0.08; // lower for mobile
    const PEAK_THRESHOLD = 0.28; // sudden peak threshold
    let recentHigh = 0;
    meterInterval = setInterval(()=>{
      analyser.getByteTimeDomainData(data);
      let sum = 0; let peak = 0;
      for(let i=0;i<data.length;i++){
        const v = (data[i]-128)/128; sum += v*v; peak = Math.max(peak, Math.abs(v));
      }
      const rms = Math.sqrt(sum / data.length);
      const isHigh = rms > RMS_THRESHOLD || peak > PEAK_THRESHOLD;
      if(isHigh) recentHigh++; else recentHigh = Math.max(0, recentHigh-1);
      // require a couple of consecutive high readings to avoid false positives
      if(recentHigh >= 2){ doBlow(); }
    }, 120);
  }

  function stopMicListening(){
    if(meterInterval){ clearInterval(meterInterval); meterInterval = null }
    if(audioContext){ try{ audioContext.close() }catch(e){} audioContext = null }
    if(audioStream){ audioStream.getTracks().forEach(t=>t.stop()); audioStream = null }
  }

  // Ambient background: darker Lorde-like instrumental pad (WebAudio)
  function startBackgroundAmbience(){
    if(bgCtx) return;
    try{
      bgCtx = new (window.AudioContext || window.webkitAudioContext)();
      bgMaster = bgCtx.createGain(); bgMaster.gain.value = 0.035; // subtle overall level
      bgMaster.connect(bgCtx.destination);

      // create a wet delay-based space for sparse ambience
      const delay = bgCtx.createDelay(1.0); delay.delayTime.value = 0.45;
      const fb = bgCtx.createGain(); fb.gain.value = 0.26;
      const fbFilter = bgCtx.createBiquadFilter(); fbFilter.type = 'lowpass'; fbFilter.frequency.value = 1200;
      delay.connect(fbFilter); fbFilter.connect(fb); fb.connect(delay);
      const wet = bgCtx.createGain(); wet.gain.value = 0.5; delay.connect(wet); wet.connect(bgMaster);

      // create two layered voices (detuned saws + sub) to get moody pad
      const voices = [];
      const baseFreqs = [55, 110];
      baseFreqs.forEach((base,i)=>{
        // two detuned saws per voice
        const o1 = bgCtx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = base * (i?2:1);
        const o2 = bgCtx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = (base * (i?2:1)) * 1.0025;
        // slight detune
        o1.detune.value = -5; o2.detune.value = 6;

        const voiceGain = bgCtx.createGain(); voiceGain.gain.value = i===0?0.12:0.08;
        const filt = bgCtx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 0.8;

        o1.connect(filt); o2.connect(filt); filt.connect(voiceGain);
        // route both dry and wet
        voiceGain.connect(bgMaster);
        voiceGain.connect(delay);

        o1.start(bgCtx.currentTime + 0.02 + i*0.02);
        o2.start(bgCtx.currentTime + 0.02 + i*0.02);

        voices.push({o1,o2,voiceGain,filt});
      });

      // subtle sub-bass sine for body
      const sub = bgCtx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 31; // low
      const subG = bgCtx.createGain(); subG.gain.value = 0.03; sub.connect(subG); subG.connect(bgMaster);
      sub.start(bgCtx.currentTime + 0.02);

      // slow LFO to modulate filter cutoff for movement
      const lfo = bgCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.06;
      const lfoGain = bgCtx.createGain(); lfoGain.gain.value = 420; // depth
      lfo.connect(lfoGain);
      voices.forEach(v=> lfoGain.connect(v.filt.frequency));
      lfo.start();

      // store nodes so we can stop later
      bgNodes = [...voices, {sub,subG}, {delay,fb,fbFilter,wet,lfo,lfoGain}];
    }catch(e){ console.warn('Background ambience failed', e); bgCtx = null; bgNodes = []; }
  }

  function stopBackgroundAmbience(){
    if(!bgCtx) return;
    try{
      // fade out master then stop nodes
      const now = bgCtx.currentTime;
      bgMaster.gain.cancelScheduledValues(now);
      bgMaster.gain.setValueAtTime(bgMaster.gain.value, now);
      bgMaster.gain.linearRampToValueAtTime(0.0, now + 1.0);
      setTimeout(()=>{
        try{
          bgNodes.forEach(n=>{
            if(n.o1) try{ n.o1.stop(); }catch(e){}
            if(n.o2) try{ n.o2.stop(); }catch(e){}
            if(n.sub) try{ n.sub.stop(); }catch(e){}
            if(n.lfo) try{ n.lfo.stop(); }catch(e){}
          });
          bgNodes = [];
          try{ bgCtx.close(); }catch(e){}
        }catch(e){}
        bgCtx = null; bgMaster = null;
      }, 1100);
    }catch(e){ bgCtx = null; bgMaster = null; bgNodes = []; }
  }
});
