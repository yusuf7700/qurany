/* QuranY — tekshirilgan oyat va hadislar ro'yxati.
   Har bir yozuv aniq manba (sura:oyat yoki hadis to'plami raqami) bilan berilgan. */

const QURANY_QUOTES = [
  // ---- Oyatlar ----
  {
    type: "ayah",
    text: "Meni zikr eting (yodlab, ibodat bilan yod eting), Men ham sizni yodlayman.",
    ref: "Baqara surasi, 152-oyat"
  },
  {
    type: "ayah",
    text: "Alloh hech bir jonni faqat ko'tara oladigan yukigagina mukallaf qiladi.",
    ref: "Baqara surasi, 286-oyat"
  },
  {
    type: "ayah",
    text: "Albatta, Biz bu Qur'onni yodda saqlash va tushunish uchun osonlashtirdik. Ibrat oluvchi bormi?",
    ref: "Qamar surasi, 17-oyat"
  },
  {
    type: "ayah",
    text: "Qur'onni shoshmasdan, tartil bilan, har bir harfini aniq chiqarib o'qi.",
    ref: "Muzzammil surasi, 4-oyat"
  },
  {
    type: "ayah",
    text: "Senga vahiy qilingan Kitobni tilovat qil va namozni to'kis ado et — chunki namoz behayolik va yomonlikdan qaytaradi.",
    ref: "Ankabut surasi, 45-oyat"
  },
  {
    type: "ayah",
    text: "Bu — senga nozil qilingan barokali Kitobdir, toki odamlar uning oyatlari ustida chuqur tafakkur qilsinlar.",
    ref: "Sod surasi, 29-oyat"
  },
  {
    type: "ayah",
    text: "Ular Qur'on ustida chuqur o'ylab ko'rmaydilarmi?!",
    ref: "Niso surasi, 82-oyat"
  },
  {
    type: "ayah",
    text: "Albatta, bu Zikrni (Qur'onni) aynan Biz nozil qildik va, albatta, uni Biz muhofaza qilib boramiz.",
    ref: "Hijr surasi, 9-oyat"
  },
  {
    type: "ayah",
    text: "Albatta, bu Qur'on eng to'g'ri yo'lga boshlaydi.",
    ref: "Isro surasi, 9-oyat"
  },
  {
    type: "ayah",
    text: "Qur'on o'quvchilar — hech qachon kasodga uchramaydigan bir savdoni umid qiladilar.",
    ref: "Fotir surasi, 29–30-oyatlar"
  },

  // ---- Hadislar ----
  {
    type: "hadith",
    text: "Sizlarning eng yaxshingiz — Qur'onni o'rgangan va uni boshqalarga o'rgatgan kishidir.",
    narrator: "Usmon ibn Affon (r.a.) rivoyat qilgan",
    source: "Sahih Buxoriy, 5027-hadis"
  },
  {
    type: "hadith",
    text: "Qur'on bilan shug'ullanuvchi kishining holi bog'langan tuyaga o'xshaydi: uni ushlab tursa, saqlab qoladi, qo'yib yuborsa — qochib ketadi.",
    narrator: "Abdulloh ibn Umar (r.a.) rivoyat qilgan",
    source: "Sahih Buxoriy, 5031-hadis va Sahih Muslim, 789-hadis"
  },
  {
    type: "hadith",
    text: "Qur'onni doimo o'qib, takrorlab turing! Jonim qo'lida bo'lgan Zot bilan qasamki, u bog'langan tuya ipidan ham tezroq qochib ketadi (esdan chiqadi).",
    narrator: "Abu Muso al-Ash'ariy (r.a.) rivoyat qilgan",
    source: "Sahih Buxoriy, 5033-hadis va Sahih Muslim, 791-hadis"
  },
  {
    type: "hadith",
    text: "Qur'onni chiroyli o'qiydigan mohir kishi hurmatli farishtalar bilan birga bo'ladi. Qiynalib, duduqlanib o'qigan kishi esa ikki hissa savob oladi.",
    narrator: "Oyisha (r.a.) rivoyat qilgan",
    source: "Sahih Buxoriy, 4937-hadis va Sahih Muslim, 798-hadis"
  },
  {
    type: "hadith",
    text: "Uylaringizni qabristonga aylantirmang. Albatta, shayton Baqara surasi o'qiladigan uydan qochib ketadi.",
    narrator: "Abu Hurayra (r.a.) rivoyat qilgan",
    source: "Sahih Muslim, 780-hadis"
  },
  {
    type: "hadith",
    text: "Ichida Alloh zikr qilinadigan uy bilan zikr qilinmaydigan uyning misoli — tirik va o'lik kabidir.",
    narrator: "Abu Muso al-Ash'ariy (r.a.) rivoyat qilgan",
    source: "Sahih Muslim, 779-hadis"
  },
  {
    type: "hadith",
    text: "Kimki Allohning Kitobidan bir harf o'qisa, unga bitta savob yoziladi, bir savob esa o'n baravar ko'payadi. \"Alif-lom-mim\"ni bir harf demayman — alif bir harf, lom bir harf, mim bir harfdir.",
    narrator: "Abdulloh ibn Mas'ud (r.a.) rivoyat qilgan",
    source: "Imom Termiziy rivoyati, 2910-hadis (sahih)"
  }
];

if (typeof module !== "undefined") module.exports = QURANY_QUOTES;
