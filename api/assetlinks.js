const PACKAGE_NAME='de.nadena.orvuno';
const fingerprintPattern=/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;

export default function handler(_req,res){
  const fingerprint=String(process.env.GOOGLE_PLAY_APP_SIGNING_SHA256||'').trim().toUpperCase();
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=300');
  if(!fingerprintPattern.test(fingerprint)){
    // Fail closed: never publish an invented or malformed signing fingerprint.
    res.status(503).json([]);
    return;
  }
  res.status(200).json([{
    relation:['delegate_permission/common.handle_all_urls'],
    target:{
      namespace:'android_app',
      package_name:PACKAGE_NAME,
      sha256_cert_fingerprints:[fingerprint]
    }
  }]);
}
