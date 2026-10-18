(function () {
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startRail);
  } else {
    startRail();
  }
})();
