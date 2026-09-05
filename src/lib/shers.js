// A few famous public-domain Urdu couplets (Ghalib, Iqbal, Mir) shown as a
// rotating "sher" on the home page — Urdu (Nastaliq) + English transliteration.
export const shers = [
  {
    ur: ['ہزاروں خواہشیں ایسی کہ ہر خواہش پہ دم نکلے', 'بہت نکلے مرے ارمان لیکن پھر بھی کم نکلے'],
    tr: ['hazaaron khwahishen aisi ke har khwahish pe dam nikle', 'bahut nikle mere armaan lekin phir bhi kam nikle'],
    poet: 'Mirza Ghalib',
  },
  {
    ur: ['نہیں تیرا نشیمن قصرِ سلطانی کے گنبد پر', 'تو شاہیں ہے بسیرا کر پہاڑوں کی چٹانوں میں'],
    tr: ['nahin tera nasheman qasr-e-sultani ke gumbad par', 'tu shaheen hai basera kar pahaadon ki chattanon mein'],
    poet: 'Allama Iqbal',
  },
  {
    ur: ['خودی کو کر بلند اتنا کہ ہر تقدیر سے پہلے', 'خدا بندے سے خود پوچھے بتا تیری رضا کیا ہے'],
    tr: ['khudi ko kar buland itna ke har taqdeer se pehle', 'Khuda bande se khud poochhe bata teri raza kya hai'],
    poet: 'Allama Iqbal',
  },
  {
    ur: ['بارے دنیا میں رہو غم زدہ یا شاد رہو', 'ایسا کچھ کر کے چلو یاں کہ بہت یاد رہو'],
    tr: ['baare duniya mein raho gham-zada ya shaad raho', 'aisa kuchh kar ke chalo yaan ke bahut yaad raho'],
    poet: 'Mir Taqi Mir',
  },
  {
    ur: ['دل ہی تو ہے نہ سنگ و خشت درد سے بھر نہ آئے کیوں', 'روئیں گے ہم ہزار بار کوئی ہمیں ستائے کیوں'],
    tr: ['dil hi to hai na sang-o-khisht dard se bhar na aaye kyun', 'royenge hum hazaar baar koi hamein sataaye kyun'],
    poet: 'Mirza Ghalib',
  },
]

export const randomSher = () => shers[Math.floor(Math.random() * shers.length)]
