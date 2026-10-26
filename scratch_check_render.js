async function checkRender() {
  const loginRes = await fetch('https://schoolsafe.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rachelberhane716@gmail.com', password: 'naba1219@Ra' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.tokens?.accessToken;
  if (!token) {
    console.error('Login failed on Render:', loginData);
    return;
  }

  const usersRes = await fetch('https://schoolsafe.onrender.com/api/admin/users', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const usersData = await usersRes.json();
  console.log('--- RENDER LIVE PRODUCTION USERS ---');
  console.log('Total users:', usersData.data?.total || usersData.data?.users?.length);
  console.log(JSON.stringify(usersData.data?.users, null, 2));
}

checkRender().catch(console.error);
