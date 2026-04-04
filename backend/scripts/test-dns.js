import dns from 'dns';

dns.resolveSrv('_mongodb._tcp.cluster0.axzjobx.mongodb.net', (err, addresses) => {
    if (err) {
        console.error('DNS Srv resolution error:', err);
    } else {
        console.log('Srv record addresses:', addresses);
    }
});
