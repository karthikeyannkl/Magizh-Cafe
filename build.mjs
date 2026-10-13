import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "public");
if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const allowedFiles = ["index.html", "admin.html", "partner.html", "partner-offers.html", "server-sync.js"];
const imageExt = /\.(png|jpe?g|webp|gif|svg|ico|avif)$/i;

for (const name of allowedFiles) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, name));
}
for (const name of fs.readdirSync(root)) {
  const src = path.join(root, name);
  if (fs.statSync(src).isFile() && imageExt.test(name)) fs.copyFileSync(src, path.join(out, name));
}

const indexPath = path.join(out, "index.html");
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, "utf8");
  const styleRe = /<style id="magizhIntroStyles">[\s\S]*?<\/style>/;
  const scriptRe = /<script id="magizhIntroScript">[\s\S]*?<\/script>/;
  if (styleRe.test(html) && scriptRe.test(html)) {
    const styleReplacement = `<style id="magizhIntroStyles">body{visibility:hidden}#magizhIntro{position:fixed;inset:0;z-index:999999;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:manipulation;visibility:visible}#magizhIntro video{width:100%;height:100%;object-fit:cover;display:block}#magizhIntro.magizhIntroHide{opacity:0;pointer-events:none;transition:opacity .35s ease}body.magizhIntroActive{overflow:hidden}body.magizhIntroReady{visibility:visible}#passwordLoginBtn,#normalLoginBtn{display:block!important;visibility:visible!important;opacity:1!important}</style>`;
    const scriptReplacement = `<script id="magizhIntroScript">(function(){function finishIntro(){const intro=document.getElementById('magizhIntro');if(!intro)return;document.body.classList.add('magizhIntroReady');intro.classList.add('magizhIntroHide');document.body.classList.remove('magizhIntroActive');setTimeout(()=>{intro.remove();if(typeof openLogin==='function'&&!getLoggedUser())openLogin();},360);}function startIntro(){const intro=document.getElementById('magizhIntro'),video=document.getElementById('magizhIntroVideo');if(!intro||!video){document.body.classList.add('magizhIntroReady');return}if(getLoggedUser()){document.body.classList.add('magizhIntroReady');intro.remove();return}document.body.classList.add('magizhIntroActive');video.addEventListener('playing',()=>{document.body.classList.add('magizhIntroReady')},{once:true});video.addEventListener('ended',finishIntro,{once:true});video.addEventListener('error',finishIntro,{once:true});const tryPlay=()=>{try{const p=video.play();if(p&&p.catch)p.catch(()=>{})}catch(e){}};tryPlay();intro.addEventListener('click',tryPlay,{passive:true});intro.addEventListener('touchstart',tryPlay,{passive:true});}document.addEventListener('DOMContentLoaded',startIntro);})();</script>`;
    html = html.replace(styleRe, styleReplacement).replace(scriptRe, scriptReplacement);
  }
  fs.writeFileSync(indexPath, html);
}
console.log("Magizh final build complete. Profile + B5/AIC + coin wallet preserved.");
