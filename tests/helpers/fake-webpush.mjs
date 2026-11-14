// web-push simulado: no manda nada a internet, solo anota lo que se le pidió enviar.
export const sent = [];
export const vapid = { last: null };
export const reset = () => { sent.length = 0; vapid.last = null; };

export default {
  setVapidDetails: (subject, pub, priv) => { vapid.last = { subject, pub, priv }; },
  sendNotification: async (sub, payload, opts) => {
    if (String(sub.endpoint).includes("gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
    if (String(sub.endpoint).includes("boom")) throw Object.assign(new Error("Boom"), { statusCode: 500 });
    sent.push({ sub, payload: JSON.parse(payload), opts });
    return { statusCode: 201 };
  },
};
