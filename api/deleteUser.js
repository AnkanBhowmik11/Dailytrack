export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing user email' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'Missing server credentials. Make sure SUPABASE_SERVICE_ROLE_KEY is set in Vercel.' });
  }

  try {
    // 1. Fetch all users from Supabase Auth to find the user ID by email
    const usersRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!usersRes.ok) {
      throw new Error(`Failed to fetch users: ${await usersRes.text()}`);
    }

    const data = await usersRes.json();
    const user = data.users?.find(u => u.email === email);

    if (!user) {
      return res.status(404).json({ error: 'User not found in Supabase Auth' });
    }

    // 2. Delete the user by ID
    const deleteRes = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!deleteRes.ok) {
      throw new Error(`Failed to delete user: ${await deleteRes.text()}`);
    }

    return res.status(200).json({ success: true, message: `User ${email} permanently deleted from Auth.` });
  } catch (error) {
    console.error('DeleteUser API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
