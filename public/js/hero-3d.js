document.addEventListener("DOMContentLoaded", () => {

    const hero = document.getElementById("cinematicHero");

    if (!hero) return;

    const slides = hero.querySelectorAll(".hero-slide");

    const nextButton = hero.querySelector(".hero-next");

    const prevButton = hero.querySelector(".hero-prev");

    const currentNumber =
        document.getElementById("heroCurrent");

    const progress =
        document.getElementById("heroProgress");


    if (!slides.length) return;


    let current = 0;

    let autoSlide;


    function showSlide(index) {

        if (index < 0) {
            index = slides.length - 1;
        }

        if (index >= slides.length) {
            index = 0;
        }

        slides.forEach((slide, i) => {

            slide.classList.toggle(
                "active",
                i === index
            );

        });


        current = index;


        if (currentNumber) {

            currentNumber.textContent =
                String(current + 1).padStart(2, "0");

        }


        if (progress) {

            const percentage =
                ((current + 1) / slides.length) * 100;

            progress.style.width =
                percentage + "%";

        }

    }


    function nextSlide() {

        showSlide(current + 1);

        restartAutoSlide();

    }


    function previousSlide() {

        showSlide(current - 1);

        restartAutoSlide();

    }


    function startAutoSlide() {

        autoSlide = setInterval(() => {

            showSlide(current + 1);

        }, 7000);

    }


    function restartAutoSlide() {

        clearInterval(autoSlide);

        startAutoSlide();

    }


    if (nextButton) {

        nextButton.addEventListener(
            "click",
            nextSlide
        );

    }


    if (prevButton) {

        prevButton.addEventListener(
            "click",
            previousSlide
        );

    }


    /* =========================================================
       KEYBOARD CONTROLS
    ========================================================= */

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "ArrowRight") {

                nextSlide();

            }

            if (event.key === "ArrowLeft") {

                previousSlide();

            }

        }
    );


    /* =========================================================
       MOUSE 3D PARALLAX
    ========================================================= */

    hero.addEventListener(
        "mousemove",
        (event) => {

            const rect =
                hero.getBoundingClientRect();

            const x =
                (event.clientX - rect.left)
                / rect.width;

            const y =
                (event.clientY - rect.top)
                / rect.height;


            const rotateX =
                (y - 0.5) * -2.5;

            const rotateY =
                (x - 0.5) * 3;


            const activeSlide =
                hero.querySelector(
                    ".hero-slide.active"
                );


            if (!activeSlide) return;


            const depthOne =
                activeSlide.querySelector(
                    ".depth-one"
                );

            const depthTwo =
                activeSlide.querySelector(
                    ".depth-two"
                );


            if (depthOne) {

                depthOne.style.transform =
                    `translate3d(
                        ${rotateY * 2}px,
                        ${rotateX * 2}px,
                        60px
                    ) scale(1.05)`;

            }


            if (depthTwo) {

                depthTwo.style.transform =
                    `translate3d(
                        ${rotateY * 4}px,
                        ${rotateX * 4}px,
                        100px
                    ) scale(1.08)`;

            }

        }
    );


    /* =========================================================
       RESET PARALLAX
    ========================================================= */

    hero.addEventListener(
        "mouseleave",
        () => {

            const activeSlide =
                hero.querySelector(
                    ".hero-slide.active"
                );

            if (!activeSlide) return;


            const depthOne =
                activeSlide.querySelector(
                    ".depth-one"
                );

            const depthTwo =
                activeSlide.querySelector(
                    ".depth-two"
                );


            if (depthOne) {

                depthOne.style.transform =
                    "translate3d(0,0,60px) scale(1.05)";

            }


            if (depthTwo) {

                depthTwo.style.transform =
                    "translate3d(0,0,100px) scale(1.08)";

            }

        }
    );


    /* =========================================================
       TOUCH / SWIPE
    ========================================================= */

    let touchStartX = 0;


    hero.addEventListener(
        "touchstart",
        (event) => {

            touchStartX =
                event.changedTouches[0].screenX;

        },
        { passive: true }
    );


    hero.addEventListener(
        "touchend",
        (event) => {

            const touchEndX =
                event.changedTouches[0].screenX;

            const distance =
                touchEndX - touchStartX;


            if (Math.abs(distance) < 50) return;


            if (distance < 0) {

                nextSlide();

            } else {

                previousSlide();

            }

        },
        { passive: true }
    );


    /* =========================================================
       INITIALIZE
    ========================================================= */

    showSlide(0);

    startAutoSlide();

});