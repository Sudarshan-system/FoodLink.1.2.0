export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      status,
      listingId,
      listingTitle,
      donorNotification,
      recipientNotification,
      donorId,
      recipientId,
    } = req.body || {};

    const notifiedTargets: Array<{ target: string; id: string; title: string }> = [];

    if (donorNotification && donorId) {
      notifiedTargets.push({ target: 'donor', id: donorId, title: donorNotification.title });
    }

    if (recipientNotification && recipientId) {
      notifiedTargets.push({ target: 'recipient', id: recipientId, title: recipientNotification.title });
    }

    return res.status(200).json({
      success: true,
      status,
      listingId,
      notifiedTargets,
      deliveredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process push notification', details: err?.message });
  }
}
