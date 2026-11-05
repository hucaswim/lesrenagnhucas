/* =========================================================
   HUCAS — Pelacakan (Google Analytics 4 + Meta Pixel)
   - ID diisi dari admin.html > tab "Pelacakan" (disimpan di data.js).
   - Pelacak HANYA dimuat setelah pengunjung menekan "Terima".
   - Kalau kedua ID kosong: tidak ada pelacak dan tidak ada banner.
   - Data pribadi (nama, nomor WA) TIDAK PERNAH dikirim ke pelacak;
     event hanya membawa jenis kelas dan lokasi.
   ========================================================= */
(function(){
  var D = window.HUCAS_DATA || {};
  var T = D.tracking || {};
  var GA = /^G-[A-Z0-9]{4,}$/i.test(String(T.gaId || '').trim()) ? String(T.gaId).trim() : '';
  var PX = /^\d{8,20}$/.test(String(T.metaPixelId || '').trim()) ? String(T.metaPixelId).trim() : '';
  var KEY = 'hucas-consent';
  var loaded = false;

  function getConsent(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function setConsent(v){ try{ localStorage.setItem(KEY, v); }catch(e){} }
  function lang(){ return (document.documentElement.lang || 'id').slice(0, 2) === 'en' ? 'en' : 'id'; }

  function loadTrackers(){
    if(loaded) return;
    loaded = true;
    if(GA){
      var s = document.createElement('script');
      s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){ window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA);
    }
    if(PX){
      !function(f,b,e,v,n,t,s){ if(f.fbq) return; n = f.fbq = function(){ n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if(!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }
      (window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', PX);
      window.fbq('track', 'PageView');
    }
  }

  // Event: 'lead' (form booking terkirim), 'whatsapp_click'
  window.hucasTrack = function(name, params){
    if(!loaded) return;
    params = params || {};
    if(GA && window.gtag){ window.gtag('event', name === 'lead' ? 'generate_lead' : name, params); }
    if(PX && window.fbq){
      if(name === 'lead') window.fbq('track', 'Lead', {content_name: params.class_type || ''});
      else if(name === 'whatsapp_click') window.fbq('track', 'Contact');
    }
  };

  document.addEventListener('click', function(e){
    var a = e.target.closest ? e.target.closest('a[href*="wa.me"]') : null;
    if(a && window.hucasTrack) window.hucasTrack('whatsapp_click', {link_url: 'wa.me'});
  });

  /* ---------- Banner persetujuan ---------- */
  var TXT = {
    id: {msg: 'Kami memakai cookie analitik (Google Analytics & Meta Pixel) untuk memahami pengunjung dan meningkatkan layanan. Data pribadimu tidak dibagikan ke sana. Kamu bisa menolak tanpa mengurangi fungsi website.', ok: 'Terima', no: 'Tolak', more: 'Kebijakan Privasi'},
    en: {msg: 'We use analytics cookies (Google Analytics & Meta Pixel) to understand visitors and improve our service. Your personal details are not shared with them. You can decline without losing any site functionality.', ok: 'Accept', no: 'Decline', more: 'Privacy Policy'}
  };
  function showBanner(){
    var old = document.getElementById('hucas-consent'); if(old) old.remove();
    var t = TXT[lang()];
    var box = document.createElement('div');
    box.id = 'hucas-consent';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookie');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:620px;margin:0 auto;background:#0B1440;color:#fff;border:3px solid #FFD400;border-radius:18px;padding:16px 18px;font:14px/1.55 Poppins,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3);';
    box.innerHTML = '<div style="margin-bottom:12px">' + t.msg + ' <a href="/privacy.html" style="color:#FFD400">' + t.more + '</a></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button id="hc-ok" style="font:700 14px Poppins,system-ui,sans-serif;background:#00BF8F;color:#0B1440;border:2px solid #fff;border-radius:999px;padding:8px 22px;cursor:pointer">' + t.ok + '</button>' +
      '<button id="hc-no" style="font:700 14px Poppins,system-ui,sans-serif;background:transparent;color:#fff;border:2px solid #fff;border-radius:999px;padding:8px 22px;cursor:pointer">' + t.no + '</button></div>';
    document.body.appendChild(box);
    document.getElementById('hc-ok').onclick = function(){ setConsent('granted'); box.remove(); loadTrackers(); };
    document.getElementById('hc-no').onclick = function(){ setConsent('denied'); box.remove(); };
  }

  function init(){
    if(!GA && !PX) return;                     // tidak ada pelacak dikonfigurasi
    document.querySelectorAll('[data-cookie-settings]').forEach(function(el){
      el.style.display = '';
      el.addEventListener('click', function(ev){ ev.preventDefault(); showBanner(); });
    });
    var c = getConsent();
    if(c === 'granted') loadTrackers();
    else if(c !== 'denied') showBanner();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
