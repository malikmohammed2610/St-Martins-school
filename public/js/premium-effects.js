/* ============================================================
   ST. MARTIN'S HIGH SCHOOL
   PREMIUM EFFECTS ENGINE
   ============================================================

   Features:
   01. Premium 3D Mouse Tilt
   02. 3D Depth / Parallax
   03. Scroll Reveal
   04. Cursor Glow
   05. Magnetic Buttons
   06. Image 3D Movement
   07. Smooth Hover Reset
   08. Performance Optimization
   09. Reduced Motion Support
   10. Mobile Optimization

   No external JavaScript library required.
   ============================================================ */

(function () {

    "use strict";


    /* ============================================================
       DOM READY
       ============================================================ */

    document.addEventListener("DOMContentLoaded", function () {

        /*
         * Respect accessibility settings.
         * If the user has enabled "Reduce Motion",
         * heavy animations are disabled.
         */

        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;


        if (reducedMotion) {

            document.documentElement.classList.add(
                "reduced-motion"
            );

            initializeRevealOnly();

            return;
        }


        /* ========================================================
           INITIALIZE ALL EFFECTS
           ======================================================== */

        initializeTilt();

        initializeDepth();

        initializeReveal();

        initializeCursorGlow();

        initializeMagneticButtons();

        initializeImageParallax();

        initializeHoverLighting();

    });



    /* ============================================================
       01. PREMIUM 3D MOUSE TILT
       ============================================================ */

    function initializeTilt() {

        const tiltElements =
            document.querySelectorAll("[data-tilt]");


        if (!tiltElements.length) {
            return;
        }


        tiltElements.forEach(function (element) {

            let animationFrame = null;

            let targetRotateX = 0;
            let targetRotateY = 0;


            element.addEventListener(
                "mouseenter",
                function () {

                    if (window.innerWidth < 992) {
                        return;
                    }

                    element.style.transition =
                        "transform 0.15s ease-out";
                }
            );


            element.addEventListener(
                "mousemove",
                function (event) {

                    if (window.innerWidth < 992) {
                        return;
                    }


                    const rect =
                        element.getBoundingClientRect();


                    const x =
                        event.clientX - rect.left;

                    const y =
                        event.clientY - rect.top;


                    const centerX =
                        rect.width / 2;

                    const centerY =
                        rect.height / 2;


                    /*
                     * Calculate mouse position
                     * relative to the center.
                     */

                    const normalizedX =
                        (x - centerX) / centerX;

                    const normalizedY =
                        (y - centerY) / centerY;


                    /*
                     * Default rotation.
                     * data-tilt-strength can override it.
                     */

                    const strength =
                        parseFloat(
                            element.dataset.tiltStrength || 5
                        );


                    targetRotateY =
                        normalizedX * strength;

                    targetRotateX =
                        normalizedY * -strength;


                    /*
                     * Use requestAnimationFrame
                     * for smoother rendering.
                     */

                    if (!animationFrame) {

                        animationFrame =
                            requestAnimationFrame(
                                function () {

                                    applyTilt(
                                        element,
                                        targetRotateX,
                                        targetRotateY
                                    );

                                    animationFrame = null;
                                }
                            );
                    }

                }
            );


            element.addEventListener(
                "mouseleave",
                function () {

                    if (animationFrame) {

                        cancelAnimationFrame(
                            animationFrame
                        );

                        animationFrame = null;
                    }


                    element.style.transition =
                        "transform 0.6s cubic-bezier(.2,.8,.2,1)";


                    element.style.transform =
                        "perspective(1200px) " +
                        "rotateX(0deg) " +
                        "rotateY(0deg) " +
                        "translateY(0px)";


                    setTimeout(function () {

                        element.style.transform = "";

                    }, 650);

                }
            );

        });

    }



    /* ============================================================
       APPLY TILT
       ============================================================ */

    function applyTilt(
        element,
        rotateX,
        rotateY
    ) {

        const lift =
            parseFloat(
                element.dataset.tiltLift || 5
            );


        element.style.transform =
            `perspective(1200px)
             rotateX(${rotateX}deg)
             rotateY(${rotateY}deg)
             translateY(-${lift}px)`;

    }



    /* ============================================================
       02. 3D DEPTH / PARALLAX
       ============================================================ */

    function initializeDepth() {

        const depthElements =
            document.querySelectorAll("[data-depth]");


        if (!depthElements.length) {
            return;
        }


        let mouseX = 0;
        let mouseY = 0;

        let currentX = 0;
        let currentY = 0;

        let animationFrame = null;


        document.addEventListener(
            "mousemove",
            function (event) {

                if (window.innerWidth < 992) {
                    return;
                }


                mouseX =
                    (event.clientX /
                        window.innerWidth - 0.5);

                mouseY =
                    (event.clientY /
                        window.innerHeight - 0.5);


                if (!animationFrame) {

                    animationFrame =
                        requestAnimationFrame(
                            updateDepth
                        );
                }

            }
        );


        function updateDepth() {

            currentX +=
                (mouseX - currentX) * 0.08;

            currentY +=
                (mouseY - currentY) * 0.08;


            depthElements.forEach(
                function (element) {

                    const depth =
                        parseFloat(
                            element.dataset.depth || 20
                        );


                    const moveX =
                        currentX * depth;

                    const moveY =
                        currentY * depth;


                    element.style.transform =
                        `translate3d(
                            ${moveX}px,
                            ${moveY}px,
                            ${depth}px
                        )`;

                }
            );


            animationFrame =
                requestAnimationFrame(
                    updateDepth
                );

        }

    }



    /* ============================================================
       03. PREMIUM SCROLL REVEAL
       ============================================================ */

    function initializeReveal() {

        const revealElements =
            document.querySelectorAll(
                ".reveal-3d"
            );


        if (!revealElements.length) {
            return;
        }


        /*
         * If IntersectionObserver isn't supported,
         * simply display everything.
         */

        if (!("IntersectionObserver" in window)) {

            revealElements.forEach(
                function (element) {

                    element.classList.add(
                        "visible"
                    );

                }
            );

            return;
        }


        const revealObserver =
            new IntersectionObserver(
                function (entries) {

                    entries.forEach(
                        function (entry) {

                            if (
                                entry.isIntersecting
                            ) {

                                /*
                                 * Small delay creates
                                 * a premium stagger.
                                 */

                                const delay =
                                    parseInt(
                                        entry.target.dataset
                                            .revealDelay ||
                                        0
                                    );


                                setTimeout(
                                    function () {

                                        entry.target.classList.add(
                                            "visible"
                                        );

                                    },
                                    delay
                                );


                                revealObserver.unobserve(
                                    entry.target
                                );

                            }

                        }
                    );

                },
                {
                    threshold: 0.12,
                    rootMargin:
                        "0px 0px -50px 0px"
                }
            );


        revealElements.forEach(
            function (element) {

                revealObserver.observe(
                    element
                );

            }
        );

    }



    /* ============================================================
       REDUCED MOTION REVEAL
       ============================================================ */

    function initializeRevealOnly() {

        const revealElements =
            document.querySelectorAll(
                ".reveal-3d"
            );


        revealElements.forEach(
            function (element) {

                element.classList.add(
                    "visible"
                );

            }
        );

    }



    /* ============================================================
       04. PREMIUM CURSOR GLOW
       ============================================================ */

    function initializeCursorGlow() {

        /*
         * Cursor glow is desktop-only.
         */

        if (window.innerWidth < 992) {
            return;
        }


        /*
         * Don't create duplicate glow elements.
         */

        if (
            document.querySelector(
                ".premium-cursor-glow"
            )
        ) {
            return;
        }


        const glow =
            document.createElement("div");


        glow.className =
            "premium-cursor-glow";


        document.body.appendChild(
            glow
        );


        let mouseX = 0;
        let mouseY = 0;

        let glowX = 0;
        let glowY = 0;


        document.addEventListener(
            "mousemove",
            function (event) {

                mouseX =
                    event.clientX;

                mouseY =
                    event.clientY;

            }
        );


        function animateGlow() {

            glowX +=
                (mouseX - glowX) * 0.12;

            glowY +=
                (mouseY - glowY) * 0.12;


            glow.style.transform =
                `translate3d(
                    ${glowX}px,
                    ${glowY}px,
                    0
                )`;


            requestAnimationFrame(
                animateGlow
            );

        }


        animateGlow();


        /*
         * Hide glow when cursor leaves
         * the browser window.
         */

        document.addEventListener(
            "mouseleave",
            function () {

                glow.style.opacity = "0";

            }
        );


        document.addEventListener(
            "mouseenter",
            function () {

                glow.style.opacity = "1";

            }
        );

    }



    /* ============================================================
       05. MAGNETIC BUTTONS
       ============================================================ */

    function initializeMagneticButtons() {

        if (window.innerWidth < 992) {
            return;
        }


        const buttons =
            document.querySelectorAll(
                "[data-magnetic]"
            );


        buttons.forEach(
            function (button) {

                button.addEventListener(
                    "mousemove",
                    function (event) {

                        const rect =
                            button.getBoundingClientRect();


                        const x =
                            event.clientX -
                            rect.left -
                            rect.width / 2;


                        const y =
                            event.clientY -
                            rect.top -
                            rect.height / 2;


                        const strength =
                            parseFloat(
                                button.dataset
                                    .magneticStrength ||
                                0.25
                            );


                        button.style.transform =
                            `translate(
                                ${x * strength}px,
                                ${y * strength}px
                            )`;

                    }
                );


                button.addEventListener(
                    "mouseleave",
                    function () {

                        button.style.transition =
                            "transform 0.45s cubic-bezier(.2,.8,.2,1)";


                        button.style.transform =
                            "translate(0, 0)";


                        setTimeout(
                            function () {

                                button.style.transition =
                                    "";

                            },
                            500
                        );

                    }
                );

            }
        );

    }



    /* ============================================================
       06. IMAGE PARALLAX
       ============================================================ */

    function initializeImageParallax() {

        const images =
            document.querySelectorAll(
                "[data-image-parallax]"
            );


        if (!images.length) {
            return;
        }


        images.forEach(
            function (image) {

                const container =
                    image.closest(
                        "[data-tilt], " +
                        ".about-photo-frame, " +
                        ".about-gallery-card"
                    );


                if (!container) {
                    return;
                }


                container.addEventListener(
                    "mousemove",
                    function (event) {

                        if (
                            window.innerWidth < 992
                        ) {
                            return;
                        }


                        const rect =
                            container
                                .getBoundingClientRect();


                        const x =
                            (
                                event.clientX -
                                rect.left
                            ) / rect.width -
                            0.5;


                        const y =
                            (
                                event.clientY -
                                rect.top
                            ) / rect.height -
                            0.5;


                        const strength =
                            parseFloat(
                                image.dataset
                                    .imageParallax ||
                                10
                            );


                        image.style.transform =
                            `scale(1.06)
                             translate(
                                ${x * strength}px,
                                ${y * strength}px
                             )`;

                    }
                );


                container.addEventListener(
                    "mouseleave",
                    function () {

                        image.style.transition =
                            "transform 0.7s cubic-bezier(.2,.8,.2,1)";


                        image.style.transform =
                            "scale(1) translate(0, 0)";

                    }
                );

            }
        );

    }



    /* ============================================================
       07. PREMIUM HOVER LIGHTING
       ============================================================ */

    function initializeHoverLighting() {

        const cards =
            document.querySelectorAll(
                ".premium-card, " +
                ".about-value-card, " +
                ".about-gallery-card, " +
                ".school-fact, " +
                ".timeline-item"
            );


        cards.forEach(
            function (card) {

                card.addEventListener(
                    "mousemove",
                    function (event) {

                        if (
                            window.innerWidth < 992
                        ) {
                            return;
                        }


                        const rect =
                            card.getBoundingClientRect();


                        const x =
                            event.clientX -
                            rect.left;


                        const y =
                            event.clientY -
                            rect.top;


                        /*
                         * CSS custom properties allow
                         * the stylesheet to position
                         * the light dynamically.
                         */

                        card.style.setProperty(
                            "--mouse-x",
                            `${x}px`
                        );


                        card.style.setProperty(
                            "--mouse-y",
                            `${y}px`
                        );

                    }
                );

            }
        );

    }



    /* ============================================================
       08. PAGE VISIBILITY OPTIMIZATION
       ============================================================ */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.hidden
            ) {

                document.documentElement
                    .classList.add(
                        "page-hidden"
                    );

            } else {

                document.documentElement
                    .classList.remove(
                        "page-hidden"
                    );

            }

        }
    );



    /* ============================================================
       09. SMOOTH ANCHOR SCROLLING
       ============================================================ */

    document.addEventListener(
        "click",
        function (event) {

            const link =
                event.target.closest(
                    'a[href^="#"]'
                );


            if (!link) {
                return;
            }


            const targetId =
                link.getAttribute("href");


            if (
                !targetId ||
                targetId === "#"
            ) {
                return;
            }


            const target =
                document.querySelector(
                    targetId
                );


            if (!target) {
                return;
            }


            event.preventDefault();


            const header =
                document.querySelector(
                    "header"
                );


            const headerHeight =
                header
                    ? header.offsetHeight
                    : 0;


            const targetPosition =
                target.getBoundingClientRect()
                    .top +
                window.scrollY -
                headerHeight -
                20;


            window.scrollTo({
                top: targetPosition,
                behavior: "smooth"
            });

        }
    );



    /* ============================================================
       10. CARD STAGGERING
       ============================================================ */

    function initializeCardStagger() {

        const groups =
            document.querySelectorAll(
                ".about-gallery-grid, " +
                ".about-values-grid, " +
                ".school-facts"
            );


        groups.forEach(
            function (group) {

                const children =
                    group.querySelectorAll(
                        ".reveal-3d"
                    );


                children.forEach(
                    function (child, index) {

                        if (
                            !child.dataset
                                .revealDelay
                        ) {

                            child.dataset
                                .revealDelay =
                                index * 90;

                        }

                    }
                );

            }
        );

    }


    /*
     * Run stagger setup immediately.
     */

    document.addEventListener(
        "DOMContentLoaded",
        initializeCardStagger
    );



})();