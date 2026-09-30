document.addEventListener('DOMContentLoaded', function () {
    const registrationForm = document.getElementById('registrationForm');
    const loginForm = document.getElementById('loginForm');
    const passwordForm = document.getElementById('passwordForm');

    function showMessage(element, message, isError = true) {
        if (!element) return;
        element.textContent = message;
        element.classList.toggle('error', isError);
        element.classList.toggle('success', !isError);
    }

    if (registrationForm) {
        registrationForm.addEventListener('submit', function (event) {
            const fullName = document.getElementById('id_full_name').value.trim();
            const email = document.getElementById('id_email').value.trim();
            const phone = document.getElementById('id_phone_number').value.trim();
            const password = document.getElementById('id_password').value;
            const confirmPassword = document.getElementById('id_confirm_password').value;
            const feedback = document.getElementById('formFeedback');

            if (!fullName || !email || !phone || !password || !confirmPassword) {
                event.preventDefault();
                showMessage(feedback, 'Please fill in all fields before submitting.', true);
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                event.preventDefault();
                showMessage(feedback, 'Please enter a valid email address.', true);
                return;
            }

            if (!/^[0-9]{10,15}$/.test(phone)) {
                event.preventDefault();
                showMessage(feedback, 'Phone number must contain only digits and be 10 to 15 digits long.', true);
                return;
            }

            if (password !== confirmPassword) {
                event.preventDefault();
                showMessage(feedback, 'Password and confirm password do not match.', true);
                return;
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function (event) {
            const email = document.getElementById('id_email').value.trim();
            const password = document.getElementById('id_password').value;
            const feedback = document.getElementById('formFeedback');

            if (!email || !password) {
                event.preventDefault();
                showMessage(feedback, 'Email and password are required.', true);
            }
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', function (event) {
            const oldPassword = document.getElementById('id_old_password').value;
            const newPassword = document.getElementById('id_new_password').value;
            const confirmPassword = document.getElementById('id_confirm_new_password').value;
            const feedback = document.getElementById('passwordFeedback');

            if (!oldPassword || !newPassword || !confirmPassword) {
                event.preventDefault();
                showMessage(feedback, 'All password fields are required.', true);
                return;
            }

            if (newPassword !== confirmPassword) {
                event.preventDefault();
                showMessage(feedback, 'New password and confirm password do not match.', true);
            }
        });
    }
});
