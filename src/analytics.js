import { Router } from 'express';
import { supabase } from './supabase.js';

const router = Router();

// General stats: total, today, this week, avg confidence
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString();

    const [totalRes, todayRes, weekRes, confidenceRes] = await Promise.all([
      supabase.from('email_log').select('id', { count: 'exact', head: true }),
      supabase.from('email_log').select('id', { count: 'exact', head: true }).gte('received_at', todayStart),
      supabase.from('email_log').select('id', { count: 'exact', head: true }).gte('received_at', weekStart),
      supabase.from('email_log').select('confidence'),
    ]);

    const confidences = (confidenceRes.data || []).map(r => r.confidence).filter(Boolean);
    const avgConfidence = confidences.length
      ? (confidences.reduce((a, b) => a + Number(b), 0) / confidences.length).toFixed(2)
      : null;

    res.json({
      total: totalRes.count || 0,
      today: todayRes.count || 0,
      week: weekRes.count || 0,
      avgConfidence,
    });
  } catch (err) {
    console.error('Analytics /stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Emails count by category
router.get('/by-category', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_log')
      .select('category');

    if (error) throw error;

    const counts = {};
    (data || []).forEach(r => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });

    // Load category labels
    const { data: cats } = await supabase
      .from('email_categories')
      .select('code, label_ru, emoji')
      .eq('active', true)
      .order('sort_order');

    const result = (cats || []).map(c => ({
      code: c.code,
      label: c.label_ru,
      emoji: c.emoji,
      count: counts[c.code] || 0,
    })).filter(c => c.count > 0);

    res.json(result);
  } catch (err) {
    console.error('Analytics /by-category error:', err);
    res.status(500).json({ error: 'Failed to load category stats' });
  }
});

// Emails per day (last 30 days)
router.get('/by-day', async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data, error } = await supabase
      .from('email_log')
      .select('received_at')
      .gte('received_at', since.toISOString())
      .order('received_at');

    if (error) throw error;

    const counts = {};
    (data || []).forEach(r => {
      const day = r.received_at.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    });

    // Fill all days including zeros
    const result = [];
    const d = new Date(since);
    const today = new Date();
    while (d <= today) {
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, count: counts[key] || 0 });
      d.setDate(d.getDate() + 1);
    }

    res.json(result);
  } catch (err) {
    console.error('Analytics /by-day error:', err);
    res.status(500).json({ error: 'Failed to load daily stats' });
  }
});

// Category trends by week (last 12 weeks)
router.get('/category-trends', async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 84); // 12 weeks

    const { data, error } = await supabase
      .from('email_log')
      .select('received_at, category')
      .gte('received_at', since.toISOString())
      .order('received_at');

    if (error) throw error;

    // Group by ISO week + category
    const weeks = {};
    (data || []).forEach(r => {
      const d = new Date(r.received_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
      const key = weekStart.toISOString().slice(0, 10);
      if (!weeks[key]) weeks[key] = {};
      weeks[key][r.category] = (weeks[key][r.category] || 0) + 1;
    });

    res.json(weeks);
  } catch (err) {
    console.error('Analytics /category-trends error:', err);
    res.status(500).json({ error: 'Failed to load trends' });
  }
});

// Top 10 senders
router.get('/top-senders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_log')
      .select('from_email, from_name');

    if (error) throw error;

    const counts = {};
    const names = {};
    (data || []).forEach(r => {
      const email = r.from_email || 'unknown';
      counts[email] = (counts[email] || 0) + 1;
      if (r.from_name) names[email] = r.from_name;
    });

    const result = Object.entries(counts)
      .map(([email, count]) => ({ email, name: names[email] || null, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json(result);
  } catch (err) {
    console.error('Analytics /top-senders error:', err);
    res.status(500).json({ error: 'Failed to load top senders' });
  }
});

// Language distribution
router.get('/languages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_log')
      .select('language');

    if (error) throw error;

    const counts = {};
    (data || []).forEach(r => {
      const lang = r.language || 'unknown';
      counts[lang] = (counts[lang] || 0) + 1;
    });

    const result = Object.entries(counts)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);

    res.json(result);
  } catch (err) {
    console.error('Analytics /languages error:', err);
    res.status(500).json({ error: 'Failed to load language stats' });
  }
});

// Recent emails (last 50)
router.get('/recent', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_log')
      .select('received_at, from_email, from_name, subject, category, summary, confidence, language')
      .order('received_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Attach category labels
    const { data: cats } = await supabase
      .from('email_categories')
      .select('code, label_ru, emoji')
      .eq('active', true);

    const catMap = {};
    (cats || []).forEach(c => { catMap[c.code] = c; });

    const result = (data || []).map(r => ({
      ...r,
      category_label: catMap[r.category]?.label_ru || r.category,
      category_emoji: catMap[r.category]?.emoji || '📨',
    }));

    res.json(result);
  } catch (err) {
    console.error('Analytics /recent error:', err);
    res.status(500).json({ error: 'Failed to load recent emails' });
  }
});

export default router;
