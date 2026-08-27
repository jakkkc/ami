// AMI Designs & Events — Contact/Booking form: submits to Supabase, shows gold toast on success

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' toast-error' : '');
  toast.hidden = false;

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 400);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inquiry-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('.form-submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalText = btnText.textContent;

    submitBtn.disabled = true;
    btnText.textContent = 'Sending…';

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      event_type: form.event_type.value || null,
      event_date: form.event_date.value || null,
      budget: form.budget.value || null,
      message: form.message.value.trim(),
    };

    const { error } = await supabaseClient.from('inquiries').insert([payload]);

    submitBtn.disabled = false;
    btnText.textContent = originalText;

    if (error) {
      console.error('Inquiry submit error:', error.message);
      showToast('Something went wrong. Please try again or message us on WhatsApp.', true);
      return;
    }

    showToast("Your inquiry has been received. We'll be in touch shortly. ✨");
    form.reset();
  });
});
