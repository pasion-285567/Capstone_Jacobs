function showContent(sectionId, element) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    document.getElementById(sectionId).classList.remove('hidden');

    let activeIndicator = document.querySelector('.active-indicator');
    let menuLinks = document.querySelectorAll('.menu a');

    menuLinks.forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    let buttonTop = element.offsetTop;
    let buttonHeight = element.offsetHeight;

    activeIndicator.style.top = `${buttonTop}px`;
    activeIndicator.style.height = `${buttonHeight}px`;
}
