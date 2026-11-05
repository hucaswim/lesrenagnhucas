/* HUCAS — interaksi ringan untuk halaman statis (tab, FAQ, peta lokasi, form booking) */
(function(){
  var cfg = {}; try{ cfg = JSON.parse(document.getElementById('hucas-cfg').textContent); }catch(e){}
  var B = cfg.brand || {};
  var en = (document.documentElement.lang || 'id').slice(0,2) === 'en';

  window.showTab = function(id, btn){
    document.querySelectorAll('#schedule .tab-panel').forEach(function(p){ p.classList.remove('active'); });
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('#schedule .tab-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
  };
  window.showPrice = function(id, btn){
    document.querySelectorAll('#pricing .price-panel').forEach(function(p){ p.classList.remove('active'); });
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('#pricing .price-tabs .price-tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
  };
  window.toggleFaq = function(btn){
    var item = btn.closest('.faq-item'), was = item.classList.contains('open');
    var list = item.parentNode;
    list.querySelectorAll('.faq-item').forEach(function(el){ el.classList.remove('open'); var q = el.querySelector('.faq-q'); if(q) q.setAttribute('aria-expanded', 'false'); });
    if(!was){ item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
  };

  /* menu mobile: tutup setelah link diketuk */
  document.querySelectorAll('#mmenu a').forEach(function(a){ a.addEventListener('click', function(){ document.getElementById('mmenu').classList.remove('open'); }); });

  /* lokasi: klik / hover → peta + foto berganti */
  var items = document.querySelectorAll('.loc-item[data-map]');
  if(items.length){
    var frame = document.getElementById('loc-map'), photo = document.getElementById('loc-photo'), open = document.getElementById('loc-open');
    var select = function(el){
      items.forEach(function(x){ x.classList.toggle('active', x === el); });
      var m = el.getAttribute('data-map'); if(frame && m && frame.getAttribute('src') !== m) frame.setAttribute('src', m);
      var p = el.getAttribute('data-photo');
      if(photo){ if(p){ photo.setAttribute('src', p); photo.setAttribute('alt', el.getAttribute('data-alt') || ''); photo.classList.add('show'); } else { photo.classList.remove('show'); photo.removeAttribute('src'); } }
      if(open && el.getAttribute('data-link')) open.setAttribute('href', el.getAttribute('data-link'));
    };
    items.forEach(function(el){
      el.addEventListener('click', function(e){ if(e.target.closest('a')) return; select(el); });
      el.addEventListener('mouseenter', function(){ select(el); });
      el.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); select(el); } });
    });
  }

  /* form booking → Google Sheets (opsional) → WhatsApp Bisnis */
  var form = document.getElementById('booking-form');
  if(form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var statusEl = document.getElementById('bf-status'), btn = document.getElementById('bf-submit');
      if(document.getElementById('bf-hp').value) return;
      var v = function(id){ return document.getElementById(id).value.trim(); };
      var payload = { name: v('bf-name'), phone: v('bf-phone'), classType: document.getElementById('bf-class').value, age: v('bf-age'), location: document.getElementById('bf-location').value, schedule: v('bf-schedule'), notes: v('bf-notes'), source: 'website' };
      if(window.hucasTrack) window.hucasTrack('lead', { class_type: payload.classType, location: payload.location });
      btn.disabled = true; statusEl.className = 'bf-status'; statusEl.innerText = en ? 'Sending...' : 'Mengirim...';
      function go(){
        var msg = (en ? 'Hi HUCAS, I just submitted a booking:' : 'Halo HUCAS, saya baru saja mengisi form booking:') +
          '\n\nNama: ' + payload.name + '\nKelas: ' + payload.classType + (payload.age ? '\nUsia: ' + payload.age : '') + '\nLokasi: ' + payload.location +
          (payload.schedule ? '\nJadwal: ' + payload.schedule : '') + (payload.notes ? '\nCatatan: ' + payload.notes : '');
        window.open('https://wa.me/' + (B.waBusiness || B.phone) + '?text=' + encodeURIComponent(msg), '_blank');
        btn.disabled = false;
      }
      var url = B.bookingWebhookUrl;
      if(!url){ statusEl.classList.add('ok'); statusEl.innerText = en ? 'Redirecting to WhatsApp...' : 'Mengarahkan ke WhatsApp...'; setTimeout(go, 400); return; }
      fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
        .then(function(){ statusEl.classList.add('ok'); statusEl.innerText = en ? 'Booking recorded! Redirecting to WhatsApp...' : 'Booking tercatat! Mengarahkan ke WhatsApp...'; setTimeout(function(){ go(); form.reset(); }, 600); })
        .catch(function(){ statusEl.classList.add('err'); statusEl.innerText = en ? "Couldn't save, but let's continue on WhatsApp." : 'Gagal menyimpan, tapi lanjut ke WhatsApp saja.'; setTimeout(go, 600); });
    });
  }
})();
