const crypto = require('crypto');
const { fdb } = require('../database/db');

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateKey(plan) {
  const prefix = plan.toUpperCase().slice(0, 3); // STR, PRO, ENT
  const random = crypto.randomBytes(8).toString('hex').toUpperCase();
  // Format: IS-STR-XXXX-XXXX-XXXX
  const parts = random.match(/.{1,4}/g).join('-');
  return `IS-${prefix}-${parts}`;
}

const PLAN_LABELS = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  trial: 'Essai gratuit',
};

// ── Admin: Créer une clé ──────────────────────────────────────────────────────

async function createKey(req, res) {
  const { plan, duration_days, max_uses = 1, note, expires_at } = req.body;
  const createdBy = req.user.userId;

  if (!plan || !PLAN_LABELS[plan]) {
    return res.status(400).json({ error: 'Plan invalide. Valeurs: starter, pro, enterprise, trial' });
  }
  const intOrNull = (v, min, max) => (v === undefined || v === null || v === '' ? null : (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : NaN));
  const days = intOrNull(duration_days, 1, 3650);
  const uses = intOrNull(max_uses, 1, 100000) ?? 1;
  if (Number.isNaN(days) || Number.isNaN(uses)) {
    return res.status(400).json({ error: 'Durée (1-3650 jours) ou nombre d\'utilisations (1-100000) invalide.' });
  }
  if (expires_at && Number.isNaN(Date.parse(expires_at))) {
    return res.status(400).json({ error: "Date d'expiration invalide." });
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 200)) {
    return res.status(400).json({ error: 'Note invalide (200 caractères maximum).' });
  }

  const key = generateKey(plan);

  try {
    const newId = await fdb.add('licenseKeys', {
      key,
      plan,
      duration_days: days,
      max_uses: uses,
      uses_count: 0,
      note: note || null,
      created_by: String(createdBy),
      expires_at: expires_at || null,
      is_active: true
    });

    const created = await fdb.getById('licenseKeys', newId);
    res.status(201).json({ key: created });
  } catch (err) {
    console.error('createKey error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la clé.' });
  }
}

// ── Admin: Lister toutes les clés ────────────────────────────────────────────

async function listKeys(req, res) {
  try {
    const keys = await fdb.getAll('licenseKeys', [], { orderBy: 'created_at', orderDir: 'desc' });

    // Enrichir avec les infos du créateur et les rédemptions
    const enriched = await Promise.all(keys.map(async (k) => {
      // Infos créateur
      let creator_name = null;
      let creator_email = null;
      if (k.created_by) {
        const creator = await fdb.getById('users', k.created_by);
        if (creator) {
          creator_name = creator.name;
          creator_email = creator.email;
        }
      }

      // Rédemptions
      const redemptions = await fdb.getAll(
        'keyRedemptions',
        [{ field: 'key_id', value: k.id }],
        { orderBy: 'redeemed_at', orderDir: 'desc' }
      );

      const redemptionsWithUsers = await Promise.all(redemptions.map(async (r) => {
        const user = await fdb.getById('users', r.user_id);
        return {
          email: user ? user.email : null,
          name: user ? user.name : null,
          redeemed_at: r.redeemed_at
        };
      }));

      return {
        ...k,
        creator_name,
        creator_email,
        redemptions: redemptionsWithUsers
      };
    }));

    res.json({ keys: enriched });
  } catch (err) {
    console.error('listKeys error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des clés.' });
  }
}

// ── Admin: Révoquer une clé ───────────────────────────────────────────────────

async function revokeKey(req, res) {
  const { id } = req.params;
  try {
    const key = await fdb.getById('licenseKeys', id);
    if (!key) return res.status(404).json({ error: 'Clé introuvable.' });

    await fdb.update('licenseKeys', id, { is_active: false });
    res.json({ message: 'Clé révoquée avec succès.' });
  } catch (err) {
    console.error('revokeKey error:', err);
    res.status(500).json({ error: 'Erreur lors de la révocation.' });
  }
}

// ── Admin: Supprimer une clé ──────────────────────────────────────────────────

async function deleteKey(req, res) {
  const { id } = req.params;
  try {
    await fdb.deleteWhere('keyRedemptions', [{ field: 'key_id', value: id }]);
    await fdb.delete('licenseKeys', id);
    res.json({ message: 'Clé supprimée.' });
  } catch (err) {
    console.error('deleteKey error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
}

// ── User: Activer une clé ─────────────────────────────────────────────────────

async function redeemKey(req, res) {
  const { key } = req.body;
  const userId = req.user.userId;

  if (!key) return res.status(400).json({ error: 'Clé manquante.' });

  try {
    const licenseKey = await fdb.getWhere('licenseKeys', [
      { field: 'key', value: key.trim().toUpperCase() },
      { field: 'is_active', value: true }
    ]);

    if (!licenseKey) {
      return res.status(404).json({ error: 'Clé invalide ou révoquée.' });
    }

    // Vérifier expiration
    if (licenseKey.expires_at && new Date(licenseKey.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Cette clé a expiré.' });
    }

    // Vérifier nombre max d'utilisations
    if (licenseKey.uses_count >= licenseKey.max_uses) {
      return res.status(409).json({ error: 'Cette clé a déjà été utilisée le nombre maximum de fois.' });
    }

    // Vérifier si l'utilisateur a déjà utilisé cette clé
    const alreadyUsed = await fdb.getWhere('keyRedemptions', [
      { field: 'key_id', value: licenseKey.id },
      { field: 'user_id', value: String(userId) }
    ]);
    if (alreadyUsed) {
      return res.status(409).json({ error: 'Vous avez déjà utilisé cette clé.' });
    }

    // Calculer la date de fin d'abonnement
    let subscriptionEndsAt = null;
    if (licenseKey.duration_days) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + licenseKey.duration_days);
      subscriptionEndsAt = endDate.toISOString();
    }

    // Consommer une utilisation de façon ATOMIQUE (évite qu'une clé à usage unique
    // soit activée plusieurs fois par des requêtes simultanées)
    const claimed = await fdb.claimLicenseUse(licenseKey.id);
    if (!claimed) {
      return res.status(409).json({ error: 'Cette clé a déjà été utilisée le nombre maximum de fois.' });
    }
    try {
      await fdb.add('keyRedemptions', {
        key_id: licenseKey.id,
        user_id: String(userId),
        redeemed_at: new Date().toISOString()
      });
    } catch (e) {
      await fdb.releaseLicenseUse(licenseKey.id); // e.g. unique index: already redeemed by this user
      return res.status(409).json({ error: 'Vous avez déjà utilisé cette clé.' });
    }

    // Mettre à jour le plan de l'utilisateur
    await fdb.update('users', userId, {
      plan: licenseKey.plan,
      subscription_status: 'active',
      subscription_ends_at: subscriptionEndsAt
    });

    res.json({
      message: `Plan "${PLAN_LABELS[licenseKey.plan]}" activé avec succès !`,
      plan: licenseKey.plan,
      duration_days: licenseKey.duration_days,
      subscription_ends_at: subscriptionEndsAt,
    });
  } catch (err) {
    console.error('redeemKey error:', err);
    res.status(500).json({ error: "Erreur lors de l'activation de la clé." });
  }
}

// ── Admin: Stats globales ─────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    const [allKeys, allRedemptions, allUsers] = await Promise.all([
      fdb.getAll('licenseKeys'),
      fdb.getAll('keyRedemptions'),
      fdb.getAll('users', [{ field: 'role', op: '!=', value: 'superadmin' }], { orderBy: 'role' })
    ]);

    const activeKeys = allKeys.filter(k => k.is_active);
    const nonAdminUsers = allUsers;
    const recentUsers = nonAdminUsers
      .sort((a, b) => {
        const aDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const bDate = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return bDate - aDate;
      })
      .slice(0, 10)
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan || null,
        subscription_status: u.subscription_status || null,
        created_at: u.created_at
      }));

    // Répartition par plan
    const planMap = {};
    for (const k of allKeys) {
      planMap[k.plan] = (planMap[k.plan] || 0) + 1;
    }
    const planBreakdown = Object.entries(planMap).map(([plan, count]) => ({ plan, count }));

    res.json({
      totalKeys: allKeys.length,
      activeKeys: activeKeys.length,
      totalRedemptions: allRedemptions.length,
      totalUsers: nonAdminUsers.length,
      planBreakdown,
      recentUsers,
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques.' });
  }
}

module.exports = {
  createKey,
  listKeys,
  revokeKey,
  deleteKey,
  redeemKey,
  getStats,
};
