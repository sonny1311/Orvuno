const PACKAGE_NAME='de.nadena.orvuno';
const APP_SIGNING_FINGERPRINTS=Object.freeze([
  '6C:B1:E0:3D:0A:6A:C6:C5:CC:46:F8:38:A8:EA:85:D2:90:30:C2:6B:C2:30:1A:E3:B2:D3:75:BA:83:67:86:DD',
  '3B:EE:09:F3:3E:44:D6:50:04:21:0C:3C:97:2F:52:47:70:B3:E6:DE:8B:DC:A5:61:AF:40:0B:4B:9E:CE:46:31',
  'BD:8A:F7:97:08:FD:CB:5B:8F:86:DF:22:29:91:DA:DE:FF:F2:7B:FE:45:F6:3D:45:93:D8:C0:C9:C5:9C:A7:C1'
]);
const fingerprintPattern=/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;

export default function handler(_req,res){
  const configured=String(process.env.GOOGLE_PLAY_APP_SIGNING_SHA256||'').trim().toUpperCase();
  const fingerprints=[...APP_SIGNING_FINGERPRINTS];
  if(fingerprintPattern.test(configured)&&!fingerprints.includes(configured))fingerprints.push(configured);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=300');
  res.status(200).json([{
    relation:['delegate_permission/common.handle_all_urls'],
    target:{
      namespace:'android_app',
      package_name:PACKAGE_NAME,
      sha256_cert_fingerprints:fingerprints
    }
  }]);
}
