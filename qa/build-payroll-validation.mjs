import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const results = JSON.parse(fs.readFileSync(path.join(dir, 'payroll-validation-results.json'), 'utf8'))
const payroll = results.testResults.filter(r => r.name.replaceAll('\\', '/').includes('/payroll/'))
const assertions = payroll.flatMap(r => r.assertionResults)
const passed = assertions.filter(r => r.status === 'passed').length
const releasePath = path.join(dir, 'payroll-release.json')
const release = fs.existsSync(releasePath) ? JSON.parse(fs.readFileSync(releasePath, 'utf8')) : null
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const cases = [
  ['שמירת היסטוריה', 'סוג השיעור, יחידותיו וזהות המפגש נשמרים במסד. שינוי סוג, משך או מספר מועדים אינו משנה שיעור שנשמר.'],
  ['נתוני העבר בדימונה', 'נבדקו כל 376 השיעורים בעותק מקומי: המספרים נשמרים כמו בחישוב הנוכחי ומסומנים טרם אומתו; לא שוחזרו משכים לפי השערה.'],
  ['השלמה מקושרת', 'השלמה חדשה יורשת את הסוג והיחידות של המקור; אם המקור הוא נתון עבר שטרם אומת, גם ההשלמה מסומנת כך.'],
  ['רשומות סותרות', 'ביטול מול דיווח של אותו מפגש, או יחידות שונות בכפילויות, עוצרים הפקת דוח עד לבירור.'],
  ['שיעור רגיל', 'נוכחות אחת או יותר → שיעור אחד, בלי תלות במספר התלמידים.'],
  ['כל התלמידים חסרים', 'השיעור נספר אם נשמרה נוכחות והוא לא בוטל — לפי אישורך.'],
  ['פתיחת מסך בלי שמירה', 'לא נוצרת יחידה בדוח.'],
  ['ביטול אחרי נוכחות', 'השיעור יורד מהסיכום למרות רשומות הנוכחות הישנות.'],
  ['ביטול שיעור השלמה', 'ההשלמה אינה נספרת.'],
  ['ביטול עם השלמה בחודש הבא', 'המקור אינו נספר; ההשלמה נספרת בחודש הביצוע לאחר שמירת נוכחות.'],
  ['החזרת שיעור שבוטל', 'שיעור עם נוכחות חוזר להיספר פעם אחת.'],
  ['מחיקת השלמה', 'לא נשארות שעות בגין ההשלמה שנמחקה.'],
  ['שיעור רגיל והשלמה באותו יום', 'שניהם נשמרים בעמודות המתאימות.'],
  ['שני שיעורים מתוכננים באותו יום', 'שני מועדים במערכת הנוכחית נספרים בנפרד.'],
  ['כפילות ישנה אחרי הזזת שעה', 'רשומות כפולות של אותו מפגש נספרות פעם אחת כשיש מועד יחיד ביום.'],
  ['ביטול היסטורי בתלוש נוכחי', 'נשמר כלל התאימות הקיים: המקור נספר, השלמה עם אותו סימון אינה נספרת שוב.'],
  ['בקשת מחלה ממתינה או דחויה', 'אינה נספרת בסיכום המחלה — לפי אישורך.'],
  ['מחלה מאושרת', 'נספרת פעם אחת ליום, גם אם היו כמה ביטולים באותו תאריך.'],
  ['רצף מחלה במעבר חודש', 'חלוקת הימים לרמות אינה מתאפסת בתחילת חודש. זו בדיקת הכלל הקיים בקוד, לא בדיקת זכאות שכר.'],
  ['שעות נוספות ממתינות או דחויות', 'אינן נכנסות לסיכום.'],
  ['אישור שעות נוספות', 'הדוח משתמש במספר הדקות שאישרה המנהלת, כולל שינוי הכמות בעת האישור.'],
  ['הוספת שעות בידי מנהלת', '3 יחידות של 45 דקות → 2:15 שעות.'],
  ['יום עם שעות נוספות בלבד', 'נספר כיום עבודה גם ללא שיעורים רגילים; עובד גם למורה ללא קבוצות.'],
  ['סוגי שיעורים', 'נבדקו 9 סוגים; תזמורת ומקהלה של 90 דקות → 2 יחידות של 45 דקות.'],
  ['אותה שעה בימים שונים', 'המשך נבחר לפי היום הנכון במערכת השבועית.'],
  ['שיעור חג / תאריך עתידי', 'אינם נספרים; חיתוך התאריך משתמש בשעון ישראל.'],
  ['מורה אחרת', 'השליפות מוגבלות למורה המבוקשת; בדיקת הרשאות מסד אמיתית עדיין נדרשת.'],
  ['מעל 1,000 רשומות', 'נבדקו נוכחות, שיעורים ושעות נוספות מעבר למגבלת תשובה בודדת.'],
  ['שגיאה בטעינת הנתונים', 'טעינת הדוח נכשלת במקום להציג סכום חלקי כאילו הוא תקין.'],
  ['אקסל מול המסך', 'שני כפתורי הייצוא משתמשים באותו גיליון; נבדקו סיכומים, ימי עבודה, ימי מחלה וקריאה מחדש של קובץ האקסל.'],
  ['חודש ריק / שנה מעוברת', 'חודש ריק לא מקבל נתונים מחודש אחר; 29 בפברואר ו־31 בדצמבר נשמרים נכון.'],
]
const manual = [
  'בסביבת בדיקה: להיכנס כמורה, לסמן נוכחות ולוודא שיעור אחד בדוח המורה ובדוח המנהלת.',
  'לבטל את השיעור שכבר סומן, לעבור שוב לדוח ולוודא שהסכום ירד בלי צורך בהתנתקות.',
  'להחזיר את השיעור ולוודא שהסכום חזר פעם אחת בלבד.',
  'לקבוע השלמה בחודש אחר: לפני נוכחות 0, אחרי נוכחות 1 בחודש הביצוע.',
  'לבטל ולמחוק השלמה עם נוכחות ולוודא שאין שארית בדוח.',
  'לשלוח 90 דקות נוספות: בהמתנה 0; לאשר 60 דקות כמנהלת ולוודא 1:00.',
  'לדחות בקשת שעות נוספת ולוודא שהדוח לא השתנה.',
  'להגיש מחלה: בהמתנה 0 ימי מחלה; אחרי אישור יום אחד; אחרי דחייה 0.',
  'לייצא משני מסכי הדוח ולהשוות כל תא מול המסך ומול חישוב ידני.',
  'לוודא שמורה אחרת אינה יכולה לראות או לשנות את הנתונים דרך כתובת ישירה.',
  'לבחור חודש אמיתי סגור ולהשוות את כל שיעוריו, ביטוליו והשלמותיו מול מקור חיצוני מאושר.',
]
const html = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>בדיקת אמינות דוח שעות</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#172332;font:16px/1.7 Arial,sans-serif}main{max-width:1120px;margin:auto;padding:35px 24px 70px}header{background:#123e51;color:white;border-radius:22px;padding:32px}h1{font-size:32px;margin:4px 0}h2{font-size:23px;margin-top:32px}small{color:#cadce6}.cards{display:flex;gap:14px;flex-wrap:wrap;margin-top:20px}.card{background:white;border:1px solid #dce5eb;border-radius:15px;padding:17px 22px;flex:1;min-width:170px}.number{font-size:32px;color:#17634e;font-weight:bold}.notice{background:#fff5da;border-right:5px solid #b87812;padding:20px;border-radius:10px;margin:22px 0}.bad{color:#9e4219}.pass{color:#17634e;font-weight:bold}table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden}th,td{padding:13px 17px;border-bottom:1px solid #e3e9ee;text-align:right;vertical-align:top}th{background:#e3edf2}td:first-child{width:27%;font-weight:bold}details{background:white;border:1px solid #dce5eb;padding:16px;border-radius:12px;margin:12px 0}summary{cursor:pointer;font-weight:bold}code{direction:ltr;display:inline-block;background:#e7eef2;padding:3px 10px;border-radius:6px}.check{display:block;background:white;padding:13px;border-bottom:1px solid #e0e7eb}.check input{margin-left:12px}li{margin-bottom:8px}.tests{direction:ltr;text-align:left;font-size:13px}.pill{background:#f8e4be;padding:4px 9px;border-radius:15px;font-size:13px}button{background:#17634e;color:white;border:0;padding:10px 20px;border-radius:8px;cursor:pointer}@media print{body{background:white}main{padding:0}button{display:none}header{background:white;color:#172332;border:1px solid}small{color:#555}.notice{break-inside:avoid}tr{break-inside:avoid}} </style>
<main><header><small>סביבת הפיתוח המקומית · ${escape(new Date(results.startTime).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }))}</small><h1>בדיקת אמינות דוח שעות</h1><div>מה נבדק, מה תוקן, ומה עדיין מונע אישור סופי.</div></header>
<div class="cards"><div class="card"><div class="number">${passed}/${assertions.length}</div>בדיקות בתחום דוח השעות עברו</div><div class="card"><div class="number">${results.numPassedTests}/${results.numTotalTests}</div>בדיקות האפליקציה עברו</div><div class="card"><div class="number">3</div>מסלולים נבדקו: מורה, מנהלת ומקור הייצוא</div></div>
<div class="notice"><strong>סטטוס: הבדיקות המקומיות ${results.numFailedTests ? 'כוללות כישלונות' : 'עברו'}; עדיין אין אישור אמינות של 100%.</strong><br>בדיקות החישוב והפעולות פועלות מול מסד מדומה. בדיקות שמירת ההיסטוריה פועלות גם על מנוע PostgreSQL מבודד, כולל עותק של נתוני דימונה. לא בוצעו דיווחי נוכחות או בקשות בדיקה בנתוני מורים אמיתיים.</div>
${release ? `<p><strong>מצב העדכון:</strong> ${escape(release.summary)}</p>` : ''}
<h2>הכללים שאישרת</h2><p>ימי מחלה נספרים רק לאחר אישור מנהלת. שיעור שבו כל התלמידים חסרים עדיין נספר אם נשמרה נוכחות והוא לא בוטל. שעות נוספות נספרות רק לאחר אישור. סך השיעורים הוא מספר יחידות שיעור; השעות הנוספות מוצגות בנפרד בשעות ודקות, כדי לא לחבר יחידות שונות.</p>
<h2>פערים ששוחזרו ותוקנו</h2><p>בריצה הראשונה 15 מתוך 42 בדיקות חדשות נכשלו. הפערים כללו השלמה שבוטלה ועדיין נספרה, כפילות בדוח המנהלת, מחלה ללא אישור, השמטת נוכחות מעבר למגבלת הרשומות והצגת דוח חלקי כששליפה נכשלה. החישוב אוחד לכל מסלולי דוח השעות. נוסף רענון דוחות אחרי נוכחות, ביטולים והחלטות מנהלת; יום עם שעות נוספות בלבד נכלל כעת בימי העבודה.</p>
<h2>מפת התרחישים שנבדקו אוטומטית</h2><table><thead><tr><th>תרחיש</th><th>התוצאה שנבדקה</th></tr></thead><tbody>${cases.map(([name, expected]) => `<tr><td>${escape(name)}</td><td>${escape(expected)}</td></tr>`).join('')}</tbody></table>
<h2 class="bad">פערים שנותרו לפני אישור סופי</h2><div class="notice"><ol>
<li><strong>אימות נתוני העבר:</strong> נתוני העבר מוקפאים לפי החישוב הנוכחי ומסומנים טרם אומתו, לפי בחירתך. ההקפאה מונעת שינוי עתידי אך אינה מוכיחה שהמשך ההיסטורי המקורי היה נכון. נדרשת השוואה לרישומים קיימים לפני אישור סופי.</li>
<li><strong>הגדרת מערכת חדשה:</strong> לתזמורת או מקהלה חדשה ללא משך חד־משמעי תופיע שגיאה במקום ניחוש. יש להגדיר שעת סיום תקינה; השלמה שנוצרת דרך הביטול משתמשת בנתוני המקור.</li>
<li><strong>נדרשת בדיקה בסביבה פעילה:</strong> מסד מדומה אינו מוכיח הרשאות אמיתיות, שמירה בפועל, רענון בין חשבונות, פעולה בכמה חלונות או כשל באמצע פעולה המורכבת מכמה כתיבות.</li>
<li><strong>כללי מחלה וחופשה:</strong> חישוב רצף המחלה הקיים נשען על תאריכי ביטולים מאושרים. יום ללא שיעור באמצע תקופת מחלה וחישוב שדה ימי החופשה דורשים הגדרת כלל עסקי; שדה ימי החופשה בדוח עדיין אינו מחושב אוטומטית.</li>
</ol></div>
<h2>בדיקת קבלה במערכת הפעילה <span class="pill">טרם בוצעה</span></h2><p>לבצע עם מורה וקבוצות בדיקה בסביבת בדיקה. הסימון כאן הוא רשימת עבודה ידנית בלבד, ואינו משנה את תוצאות הבדיקות האוטומטיות.</p>${manual.map((item, i) => `<label class="check"><input type="checkbox" data-check="${i}">${escape(item)}</label>`).join('')}
<h2>פירוט הבדיקות והרצה חוזרת</h2><p>הרצת בדיקות הדוח: <code>npm run test:payroll</code><br>הרצת כל הבדיקות וחידוש הדוח הזה: <code>npm run qa:payroll</code>. אם בדיקה נכשלת, הפקודה נעצרת לפני חידוש הדוח; יש לעיין בפלט הכישלון. תאריך הדוח מופיע בראש העמוד.</p>
${payroll.map(file => `<details><summary>${escape(path.basename(file.name))} — ${file.assertionResults.filter(t => t.status === 'passed').length}/${file.assertionResults.length}</summary><ul class="tests">${file.assertionResults.map(test => `<li><strong>${escape(test.status)}</strong> · ${escape(test.fullName)}</li>`).join('')}</ul></details>`).join('')}
<button onclick="window.print()">הדפסה / שמירה כ־PDF</button></main>
<script>document.querySelectorAll('[data-check]').forEach(input=>{const key='payroll-qa-20261007-'+input.dataset.check;try{input.checked=localStorage.getItem(key)==='1'}catch{}input.addEventListener('change',()=>{try{localStorage.setItem(key,input.checked?'1':'0')}catch{}})})</script></html>`
fs.writeFileSync(path.join(dir, 'payroll-validation.html'), html)
console.log(`Payroll validation report: ${passed}/${assertions.length} checks passed; known gaps and live acceptance checklist included.`)
