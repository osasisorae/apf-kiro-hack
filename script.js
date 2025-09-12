document.addEventListener('DOMContentLoaded', function() {
    // Initialize all effects
    initScrollAnimations();
    initNavbarEffects();
    initParallaxEffect();
    initFloatingElements();
    initTypingEffect();
    
    // Handle both forms
    setupForm('waitlistForm', 'email', 'errorMessage', 'successMessage');
    setupForm('finalWaitlistForm', 'finalEmail', 'finalErrorMessage', 'finalSuccessMessage');
});

function setupForm(formId, emailId, errorId, successId) {
    const form = document.getElementById(formId);
    const emailInput = document.getElementById(emailId);
    const errorMessage = document.getElementById(errorId);
    const successMessage = document.getElementById(successId);
    
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        
        // Clear previous errors
        hideError(errorMessage);
        
        // Validate email
        if (!isValidEmail(email)) {
            showError(errorMessage, 'Please enter a valid email address');
            return;
        }
        
        // Add loading state
        const button = form.querySelector('.cta-button');
        const originalText = button.textContent;
        button.textContent = 'Joining...';
        button.disabled = true;
        
        try {
            // Call our API
            const result = await simulateApiCall(email);
            
            // Debug: Log the result to see what we're getting
            console.log('API Result:', result);
            
            // Store email locally as backup
            storeEmail(email);
            
            // Update success message with position
            const successTitle = successMessage.querySelector('h3');
            const successText = successMessage.querySelector('p');
            if (successTitle) successTitle.textContent = 'Thank you. You\'re on the list.';
            if (successText) {
                const position = result && result.position ? result.position : 'unknown';
                successText.textContent = `You're #${position} in line. Get ready for the future of trading.`;
            }
            
            // Show success state
            form.style.display = 'none';
            successMessage.style.display = 'block';
            
            // Add celebration effect
            addCelebrationEffect();
            
        } catch (error) {
            console.error('Form submission error:', error);
            showError(errorMessage, error.message || 'Something went wrong. Please try again.');
            button.textContent = originalText;
            button.disabled = false;
        }
    });
    
    // Real-time email validation
    emailInput.addEventListener('input', function() {
        if (errorMessage.classList.contains('show')) {
            hideError(errorMessage);
        }
    });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(errorElement, message) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

function hideError(errorElement) {
    errorElement.classList.remove('show');
}

async function simulateApiCall(email) {
    try {
        console.log('Making API call to /api/waitlist with email:', email);
        
        const response = await fetch('/api/waitlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Something went wrong');
        }

        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

function storeEmail(email) {
    let emails = JSON.parse(localStorage.getItem('aurumWaitlistEmails') || '[]');
    if (!emails.includes(email)) {
        emails.push({
            email: email,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('aurumWaitlistEmails', JSON.stringify(emails));
    }
}

function addCelebrationEffect() {
    // Create subtle golden particles
    for (let i = 0; i < 20; i++) {
        createParticle();
    }
}

function createParticle() {
    const particle = document.createElement('div');
    particle.style.cssText = `
        position: fixed;
        width: 4px;
        height: 4px;
        background: linear-gradient(45deg, #D4AF37, #FFD700);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        left: ${Math.random() * 100}vw;
        top: ${Math.random() * 100}vh;
        animation: float 3s ease-out forwards;
    `;
    
    document.body.appendChild(particle);
    
    setTimeout(() => {
        particle.remove();
    }, 3000);
}

// Add CSS for particle animation
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.classList.add('fade-in-on-scroll');
        observer.observe(card);
    });
    
    // Observe section titles
    document.querySelectorAll('.features-title, .final-title').forEach(title => {
        title.classList.add('fade-in-on-scroll');
        observer.observe(title);
    });
}

function initParallaxEffect() {
    let ticking = false;
    
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.hero::before');
        
        parallaxElements.forEach(element => {
            const speed = 0.5;
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
        
        ticking = false;
    }
    
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick);
}

// Smooth scroll for any internal links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add keyboard navigation support
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.type === 'email') {
        e.target.closest('form').dispatchEvent(new Event('submit'));
    }
});

function initNavbarEffects() {
    const nav = document.querySelector('.nav');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}

function initFloatingElements() {
    const floatingElements = document.querySelectorAll('.floating-element');
    
    floatingElements.forEach((element, index) => {
        const speed = parseFloat(element.dataset.speed) || 0.5;
        const size = Math.random() * 6 + 2;
        const delay = Math.random() * 20;
        
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.animationDelay = `${delay}s`;
        element.style.animationDuration = `${20 / speed}s`;
    });
}

function initTypingEffect() {
    const badge = document.querySelector('.badge-text');
    if (!badge) return;
    
    const text = 'REVOLUTIONARY AI TRADING';
    const chars = text.split('');
    badge.textContent = '';
    
    chars.forEach((char, index) => {
        setTimeout(() => {
            badge.textContent += char;
        }, index * 100 + 2000);
    });
}

// Enhanced parallax with mouse movement
function initParallaxEffect() {
    let ticking = false;
    
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.hero-background');
        
        parallaxElements.forEach(element => {
            const speed = 0.5;
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
        
        ticking = false;
    }
    
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick);
    
    // Mouse parallax effect
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        const floatingElements = document.querySelectorAll('.floating-element');
        floatingElements.forEach((element, index) => {
            const speed = (index + 1) * 0.02;
            const x = (mouseX - 0.5) * speed * 100;
            const y = (mouseY - 0.5) * speed * 100;
            
            element.style.transform += ` translate(${x}px, ${y}px)`;
        });
        
        // Chart parallax
        const chart = document.querySelector('.chart-container');
        if (chart) {
            const x = (mouseX - 0.5) * 20;
            const y = (mouseY - 0.5) * 20;
            chart.style.transform = `translate(${x}px, ${y}px)`;
        }
    });
}

// Enhanced form submission with more effects
async function simulateApiCall(email) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (Math.random() > 0.05) {
                resolve();
            } else {
                reject(new Error('Network error'));
            }
        }, 2000);
    });
}

function addCelebrationEffect() {
    // Create golden particles explosion
    for (let i = 0; i < 50; i++) {
        createParticle();
    }
    
    // Screen flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, transparent 70%);
        pointer-events: none;
        z-index: 9999;
        animation: flash 0.5s ease-out;
    `;
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.remove();
    }, 500);
}

function createParticle() {
    const particle = document.createElement('div');
    const size = Math.random() * 8 + 4;
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    const rotation = Math.random() * 360;
    
    particle.style.cssText = `
        position: fixed;
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(45deg, #D4AF37, #FFD700, #B8860B);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        left: ${x}px;
        top: ${y}px;
        transform: rotate(${rotation}deg);
        animation: explode 2s ease-out forwards;
    `;
    
    document.body.appendChild(particle);
    
    setTimeout(() => {
        particle.remove();
    }, 2000);
}

// Add more CSS animations
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    @keyframes flash {
        0% { opacity: 0; }
        50% { opacity: 1; }
        100% { opacity: 0; }
    }
    
    @keyframes explode {
        0% {
            transform: scale(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: scale(1) rotate(720deg) translateY(-200px);
            opacity: 0;
        }
    }
    
    .hero-title .title-line {
        display: inline-block;
        animation: slideInFromLeft 1s ease-out forwards;
    }
    
    .hero-title .title-emphasis {
        animation: slideInFromRight 1s ease-out 0.3s forwards;
    }
    
    @keyframes slideInFromLeft {
        from {
            transform: translateX(-100px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideInFromRight {
        from {
            transform: translateX(100px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(additionalStyles);