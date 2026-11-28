(function () {
  function startHeroHeader() {
    var header = document.querySelector('.site-header');
    if (!header || !document.body.classList.contains('has-hero-header')) return;
    function apply() {
      header.classList.toggle('is-solid', window.scrollY > 12);
    }
    apply();
    window.addEventListener('scroll', apply, { passive: true });
  }

  function startShopMenu() {
    var drop = document.querySelector('.nav-drop');
    if (!drop) return;
    var link = drop.querySelector('.nav-drop-link');
    if (!link) return;

    var closeTimer = null;

    function setOpen(open) {
      drop.classList.toggle('is-open', open);
      link.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function openMenu() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      drop.classList.remove('force-close');
      setOpen(true);
    }

    function holdMenu() {
      if (drop.classList.contains('force-close')) return;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      setOpen(true);
    }

    function closeMenuSoon() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        closeTimer = null;
        if (drop.matches(':hover') || drop.contains(document.activeElement)) return;
        setOpen(false);
      }, 400);
    }

    drop.addEventListener('mouseenter', openMenu);
    drop.addEventListener('mouseleave', closeMenuSoon);
    drop.addEventListener('focusin', function () {
      if (drop.classList.contains('force-close')) return;
      holdMenu();
    });
    drop.addEventListener('focusout', function (event) {
      if (!drop.contains(event.relatedTarget)) {
        drop.classList.remove('force-close');
        closeMenuSoon();
      }
    });
    document.addEventListener('wheel', function (event) {
      if (drop.contains(event.target) || drop.matches(':hover')) holdMenu();
    }, { passive: true });
    window.addEventListener('scroll', function () {
      if (drop.matches(':hover') || drop.contains(document.activeElement)) holdMenu();
    }, { passive: true });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && (drop.classList.contains('is-open') || drop.matches(':hover, :focus-within'))) {
        drop.classList.add('force-close');
        setOpen(false);
        link.focus();
      }
    });
  }

  function startRail() {
    if (!window.jQuery || !jQuery.fn.slick) return;
    var $rail = jQuery('.batch-rail');
    if (!$rail.length || $rail.hasClass('slick-initialized')) return;
    $rail.slick({
      arrows: true,
      dots: false,
      infinite: false,
      slidesToShow: 4,
      slidesToScroll: 1,
      responsive: [
        { breakpoint: 1200, settings: { slidesToShow: 3 } },
        { breakpoint: 992, settings: { slidesToShow: 2, arrows: false, dots: true } },
        { breakpoint: 576, settings: { slidesToShow: 1, arrows: false, dots: true } }
      ]
    });
  }
  function startFaq() {
    var lists = document.querySelectorAll('.faq-list');
    for (var n = 0; n < lists.length; n++) {
      lists[n].addEventListener('toggle', function (event) {
        var opened = event.target;
        if (!opened.open || !this.contains(opened)) return;
        var items = this.querySelectorAll('.faq-item');
        for (var i = 0; i < items.length; i++) {
          if (items[i] !== opened && items[i].open) items[i].open = false;
        }
      }, true);
    }
    var id = '';
    try { id = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (error) { id = ''; }
    if (!id) return;
    var fold = document.getElementById(id);
    if (fold && fold.classList && fold.classList.contains('desk-fold')) fold.open = true;
  }

  function startCollectionVideos() {
    var videos = document.querySelectorAll('.drawer-video');
    for (var i = 0; i < videos.length; i++) {
      var play = videos[i].play();
      if (play && play.catch) play.catch(function () {});
    }
  }

  function shrinkImage(file) {
    var longest = 1800;
    return createImageBitmap(file).then(function (bitmap) {
      var scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size < 900 * 1024) return null;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      var type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) return resolve(null);
          var ext = blob.type === 'image/jpeg' ? '.jpg' : blob.type === 'image/webp' ? '.webp' : '.png';
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + ext, { type: blob.type }));
        }, type, 0.86);
      });
    });
  }

  function startImageUploads() {
    var inputs = document.querySelectorAll('input[type="file"][accept*="image/"]');
    if (!inputs.length || !window.DataTransfer || !window.createImageBitmap) return;
    Array.prototype.forEach.call(inputs, function (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return;
        shrinkImage(file).then(function (smaller) {
          if (!smaller) return;
          var transfer = new DataTransfer();
          transfer.items.add(smaller);
          input.files = transfer.files;
        }).catch(function () {});
      });
    });
  }

  function calmMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function startSliders() {
    var sliders = document.querySelectorAll('[data-slider]');
    Array.prototype.forEach.call(sliders, function (slider) {
      var track = slider.querySelector('[data-slider-track]');
      var slides = track ? track.children : [];
      var dotsBox = slider.querySelector('[data-slider-dots]');
      var prev = slider.querySelector('[data-slider-prev]');
      var next = slider.querySelector('[data-slider-next]');
      if (!track || slides.length < 2) return;
      var dots = [];
      var timer = null;

      function step() {
        return slides[1].offsetLeft - slides[0].offsetLeft;
      }
      function pages() {
        return slides.length;
      }
      function current() {
        var size = step();
        return size ? Math.min(slides.length - 1, Math.round(track.scrollLeft / size)) : 0;
      }
      function go(index) {
        var count = pages();
        var target = ((index % count) + count) % count;
        track.scrollTo({ left: slides[target].offsetLeft - slides[0].offsetLeft, behavior: calmMotion() ? 'auto' : 'smooth' });
      }
      function drawDots() {
        if (!dotsBox) return;
        dotsBox.innerHTML = '';
        dots = [];
        for (var i = 0; i < pages(); i++) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'loved-dot';
          dot.setAttribute('aria-label', 'Show testimonial ' + (i + 1));
          dot.addEventListener('click', (function (n) { return function () { go(n); restart(); }; })(i));
          dotsBox.appendChild(dot);
          dots.push(dot);
        }
        mark();
      }
      function mark() {
        var at = current();
        dots.forEach(function (dot, i) {
          dot.classList.toggle('is-active', i === at);
          dot.setAttribute('aria-current', i === at ? 'true' : 'false');
        });
        var single = pages() < 2;
        slider.classList.toggle('is-static', single);
      }
      function stop() {
        if (timer) clearInterval(timer);
        timer = null;
      }
      function restart() {
        stop();
        if (calmMotion() || pages() < 2) return;
        timer = setInterval(function () { go(current() + 1); }, 7000);
      }

      if (prev) prev.addEventListener('click', function () { go(current() - 1); restart(); });
      if (next) next.addEventListener('click', function () { go(current() + 1); restart(); });
      track.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowRight') { event.preventDefault(); go(current() + 1); restart(); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); go(current() - 1); restart(); }
      });
      var markTimer = null;
      track.addEventListener('scroll', function () {
        if (markTimer) clearTimeout(markTimer);
        markTimer = setTimeout(mark, 80);
      }, { passive: true });
      slider.addEventListener('mouseenter', stop);
      slider.addEventListener('mouseleave', restart);
      slider.addEventListener('focusin', stop);
      slider.addEventListener('focusout', function (event) {
        if (!slider.contains(event.relatedTarget)) restart();
      });
      var resizeTimer = null;
      window.addEventListener('resize', function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { drawDots(); restart(); }, 150);
      });
      drawDots();
      restart();
    });
  }

  function startToTop() {
    var button = document.querySelector('[data-to-top]');
    if (!button) return;
    function apply() {
      button.classList.toggle('is-visible', window.scrollY > Math.min(600, window.innerHeight * 0.8));
    }
    apply();
    window.addEventListener('scroll', apply, { passive: true });
    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: calmMotion() ? 'auto' : 'smooth' });
      var skip = document.querySelector('.site-header a, header a');
      if (skip) skip.focus({ preventScroll: true });
    });
  }

  function startContactTopic() {
    var topic = document.querySelector('#topic');
    var extra = document.querySelector('[data-testimonial-extra]');
    var message = document.querySelector('#message');
    if (!topic || !extra || !message) return;
    var box = document.querySelector('#permit');
    var townBox = document.querySelector('#show-town');
    var townField = document.querySelector('[data-town-field]');
    var townInput = townField ? townField.querySelector('input') : null;
    function applyTown() {
      var show = topic.value === 'A testimonial' && townBox && townBox.checked;
      if (townField) townField.hidden = !show;
      if (townInput) townInput.required = !!show;
    }
    function apply() {
      var on = topic.value === 'A testimonial';
      extra.hidden = !on;
      if (box) box.required = on;
      message.maxLength = on ? 600 : 1500;
      message.placeholder = on ? 'The words you’d like us to show.' : '';
      applyTown();
    }
    topic.addEventListener('change', apply);
    if (townBox) townBox.addEventListener('change', applyTown);
    apply();
  }

  function start() {
    startHeroHeader();
    startSliders();
    startToTop();
    startShopMenu();
    startRail();
    startFaq();
    startCollectionVideos();
    startImageUploads();
    startContactTopic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
