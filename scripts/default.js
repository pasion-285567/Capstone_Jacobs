function showContent(sectionId, element) {
    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    // Show the selected section
    document.getElementById(sectionId).classList.remove('hidden');

    // Move highlight indicator
    let activeIndicator = document.querySelector('.active-indicator');
    let menuLinks = document.querySelectorAll('.menu a');

    menuLinks.forEach(link => link.classList.remove('active')); // Remove active class
    element.classList.add('active'); // Add active class to clicked link

    // Get exact position and height of the clicked button
    let buttonTop = element.offsetTop; // Exact position sa sidebar
    let buttonHeight = element.offsetHeight; // Sakto sa taas ng button

    // Apply position and height to the highlight
    activeIndicator.style.top = `${buttonTop}px`;
    activeIndicator.style.height = `${buttonHeight}px`;
}
