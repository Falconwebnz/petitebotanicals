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

  function start() {
    startHeroHeader();
    startShopMenu();
    startRail();
    startFaq();
    startCollectionVideos();
    startImageUploads();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
