'use strict';
(() => {
  const { api, setUser } = window.Apex;
  const form = document.getElementById('regForm');
  const status = document.getElementById('status');
  const f = { name: form.name, email: form.email, password: form.password, confirm: form.confirm, team: form.team };

  // Saneamiento básico: quita etiquetas/comillas/caracteres de control y recorta espacios
  const sanitize = v => String(v).replace(/[<>"'`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();

  const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .-]{2,50}$/;
  const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  const rules = [
    ['len', p => p.length >= 8], ['num', p => /\d/.test(p)], ['up', p => /[A-Z]/.test(p)]
  ];

  const setErr = (key, msg) => {
    document.getElementById(`err-${key}`).textContent = msg;
    f[key].setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };

  const check = {
    name: () => setErr('name', NAME_RE.test(sanitize(f.name.value)) ? '' : 'Usa 2 a 50 letras (sin números ni símbolos).'),
    email: () => setErr('email', EMAIL_RE.test(sanitize(f.email.value)) ? '' : 'Escribe un correo válido, por ejemplo piloto@correo.com.'),
    password: () => {
      const p = f.password.value;
      rules.forEach(([id, fn]) => document.getElementById(`rule-${id}`).classList.toggle('ok', fn(p)));
      return setErr('password', rules.every(([, fn]) => fn(p)) ? '' : 'La contraseña no cumple los requisitos.');
    },
    confirm: () => setErr('confirm', f.confirm.value === f.password.value && f.confirm.value ? '' : 'Las contraseñas no coinciden.'),
    team: () => setErr('team', f.team.value ? '' : 'Elige tu escudería favorita.')
  };

  Object.keys(check).forEach(k => {
    f[k].addEventListener('input', check[k]);
    f[k].addEventListener('blur', check[k]);
  });
  f.password.addEventListener('input', check.confirm);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.className = 'status';
    status.textContent = '';
    const valid = Object.values(check).map(fn => fn()).every(Boolean);
    if (!valid) { status.className = 'status error'; status.textContent = 'Corrige los campos marcados.'; return; }

    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const r = await api('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sanitize(f.name.value), email: sanitize(f.email.value),
          password: f.password.value, team: f.team.value
        })
      });
      setUser(r.user); // solo nombre y escudería; nunca la contraseña
      status.className = 'status ok';
      status.textContent = `¡Registro completado, ${r.user.name}! Redirigiendo al inicio…`;
      form.reset();
      setTimeout(() => { location.href = '/'; }, 1800);
    } catch (err) {
      status.className = 'status error';
      status.textContent = err.message;
      Object.entries(err.data?.errors || {}).forEach(([k, m]) => f[k] && setErr(k, m));
    } finally { btn.disabled = false; }
  });
})();
