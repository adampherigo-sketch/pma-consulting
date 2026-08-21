// PMA Consulting — Shared Navigation

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector("[data-site-header]");

  if (!header) {
    return;
  }

  header.innerHTML = `
    <a
      class="brand"
      href="index.html"
      aria-label="PMA Consulting home"
    >
      <span class="brand-mark" aria-hidden="true">
        <img src="images/logo-2.png" alt="">
      </span>

      <span class="brand-copy">
        <strong>PMA Consulting</strong>
        <small>Inclusive Event Strategy</small>
      </span>
    </a>

    <button
      class="nav-toggle"
      type="button"
      aria-expanded="false"
      aria-controls="primary-navigation"
      aria-label="Open navigation"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <nav
      class="primary-nav"
      id="primary-navigation"
      aria-label="Primary navigation"
    >
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="services.html">Services</a>
      <a href="events.html">Events</a>
      <a class="nav-contact-link" href="contact.html">Contact</a>
    </nav>
  `;

  document.querySelectorAll("#current-year, [data-current-year]").forEach(
    (element) => {
      element.textContent = new Date().getFullYear();
    }
  );

  const navToggle = header.querySelector(".nav-toggle");
  const primaryNav = header.querySelector(".primary-nav");
  const navigationLinks = primaryNav.querySelectorAll("a");

  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  navigationLinks.forEach((link) => {
    const linkPage = link.getAttribute("href");

    if (linkPage === currentPage) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";

    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navToggle.setAttribute(
      "aria-label",
      isOpen ? "Open navigation" : "Close navigation"
    );

    header.classList.toggle("nav-open", !isOpen);
    primaryNav.classList.toggle("is-open", !isOpen);
  });

  navigationLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open navigation");
      header.classList.remove("nav-open");
      primaryNav.classList.remove("is-open");
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open navigation");
      header.classList.remove("nav-open");
      primaryNav.classList.remove("is-open");
    }
  });
});