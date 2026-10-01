# End-to-end murojaat lifecycle check against a LOCAL backend (never prod).
# Needs: backend on :3300 with OTP_DEV_ECHO=true and a SUPER_ADMIN localadmin.
# Run: python3 apps/backend/test/e2e/murojaat_flow.py
import json, urllib.request, uuid
B='http://localhost:3300'
def call(method, path, body=None, token=None, expect=None):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(B+path, data=data, method=method)
    req.add_header('Content-Type','application/json')
    if token: req.add_header('Authorization','Bearer '+token)
    try:
        with urllib.request.urlopen(req) as r:
            txt=r.read().decode(); code=r.status
    except urllib.error.HTTPError as e:
        txt=e.read().decode(); code=e.code
    out=json.loads(txt) if txt else None
    if expect and code!=expect: print('!!', method, path, code, txt[:300])
    return code, out
ok=lambda c,msg: print(('PASS ' if c else 'FAIL ')+msg)

# admin
c,a=call('POST','/auth/admin/login',{'username':'localadmin','password':__import__('os').environ.get('LOCAL_ADMIN_PASSWORD','')},expect=200); admin=a['accessToken']
# employee via oversight
u='flowtest_'+uuid.uuid4().hex[:6]
c,e=call('POST','/oversight/employee',{'fullName':'Flow Test Xodim','position':'Inspektor','username':u,'password':'secret12'},admin,expect=201); emp_id=e['id']
c,l=call('POST','/auth/employee/login',{'username':u,'password':'secret12'},expect=200); emp=l['accessToken']
# citizen (OTP echo local)
phone='+99891'+str(uuid.uuid4().int)[:7]
c,o=call('POST','/auth/request-otp',{'phone':phone},expect=200)
code=o.get('devCode') or o.get('code')
c,v=call('POST','/auth/verify-otp',{'phone':phone,'code':code},expect=200); cit=v['accessToken']
# other citizen
phone2='+99893'+str(uuid.uuid4().int)[:7]
c,o2=call('POST','/auth/request-otp',{'phone':phone2}); c,v2=call('POST','/auth/verify-otp',{'phone':phone2,'code':o2.get('devCode')}); cit2=v2['accessToken']

# 1. citizen submits
c,app=call('POST','/applications',{'applicantFullName':'Test Fuqaro','applicantPhone':phone,'subject':"[SHIKOYAT|Elektr] Ko'cha chirog'i yonmayapti",'description':"Mustaqillik ko'chasi 12-uy oldida chiroq bir haftadan beri yonmayapti",'priority':'high','address':"Mustaqillik 12"},cit,expect=201)
aid=app['id']; ok(app.get('dueAt') is not None and app['priority']=='high','created with SLA dueAt (high=48h)')
# 2. admin sees it in /requests
c,lst=call('GET','/requests?limit=100',token=admin,expect=200)
row=next((r for r in lst['data'] if r['id']==aid),None)
ok(row is not None and row['source']=='citizen' and row['category']=='elektr' and row['kind']=='shikoyat' and row['title'].startswith("Ko'cha"),'admin /requests shows the citizen murojaat (category elektr, kind shikoyat)')
# 3. admin assigns real employee
c,up=call('PATCH','/requests/'+aid,{'assignedWorkerId':emp_id,'status':'in_progress'},admin,expect=200)
ok(up['status']=='in_progress' and up['assignedEmployee']['id']==emp_id,'admin assigns -> in_progress + assignee resolved')
# 4. employee sees it (assignedTo=me) + notification
c,mine=call('GET','/applications?assignedTo=me&limit=50',token=emp,expect=200)
ok(any(x['id']==aid for x in mine['data']),'employee sees it under assignedTo=me')
c,notes=call('GET',f'/notifications/employee/{emp_id}',token=emp)
ok(c==200 and any('biriktirildi' in n.get('title','') for n in notes),'employee got "Yangi murojaat biriktirildi" notification')
c,_=call('GET',f'/notifications/employee/{emp_id}',token=cit2); ok(c==403,'citizen cannot read employee notifications')
# 5. security: other citizen blocked; forged role ignored
c,_=call('GET',f'/applications/{aid}/messages',token=cit2); ok(c==403,'other citizen cannot read thread (403)')
c,_=call('GET',f'/applications/{aid}/messages'); ok(c==401,'anonymous cannot read thread (401)')
c,m=call('POST',f'/applications/{aid}/messages',{'senderRole':'EMPLOYEE','senderName':'Hacker','text':'fake'},cit,expect=201)
ok(m['senderRole']=='CITIZEN','citizen cannot post as EMPLOYEE (role from token)')
# 6. employee resolves with reply
c,r=call('POST',f'/applications/{aid}/reply',{'text':'Chiroq almashtirildi, rasm ilova qilindi.','resolve':True},emp,expect=201)
c,d=call('GET','/applications/'+aid,token=cit,expect=200)
ok(d['status']=='RESOLVED' and d['resolvedAt'],'employee reply resolve:true -> RESOLVED + resolvedAt')
# 7. citizen rates
c,rt=call('POST',f'/applications/{aid}/rate',{'rating':5,'comment':'Rahmat!'},cit,expect=201)
ok(rt['rating']==5,'citizen rates 5')
c,_=call('POST',f'/applications/{aid}/rate',{'rating':4},cit2); ok(c==403,'other citizen cannot rate (403)')
# 8. reopen
c,ro=call('POST',f'/applications/{aid}/reopen',{'reason':'Yana yonmay qoldi'},cit,expect=201)
ok(ro['status']=='IN_PROGRESS' and ro['rating'] is None,'citizen reopens -> IN_PROGRESS')
# 9. events trail
c,ev=call('GET',f'/applications/{aid}/events',token=admin,expect=200)
types=[e['type'] for e in ev]; ok(all(t in types for t in ['CREATED','ASSIGNED','STATUS_CHANGED','MESSAGE','RATED','REOPENED']),'audit trail: '+','.join(types))
# 10. stats
c,st=call('GET','/applications/stats',token=admin,expect=200)
ok(st['total']>=1 and 'byEmployee' in st,'stats ok: '+json.dumps({k:st[k] for k in ['total','overdue','unassigned','avgResolutionHours','avgRating']}))
c,rs=call('GET','/requests/stats',token=admin,expect=200); ok(rs['byCategory']['elektr']>=1,'/requests/stats counts citizen murojaats')
# 11. idempotent create replay
key=str(uuid.uuid4())
def post_key():
    req=urllib.request.Request(B+'/applications',data=json.dumps({'applicantFullName':'Test Fuqaro','applicantPhone':phone,'subject':'[ARIZA|Suv] Suv yo\'q','description':'Ikki kundan beri suv kelmayapti uyda'}).encode(),method='POST')
    req.add_header('Content-Type','application/json'); req.add_header('Authorization','Bearer '+cit); req.add_header('Idempotency-Key',key)
    with urllib.request.urlopen(req) as r: return json.loads(r.read())
a1=post_key(); a2=post_key(); ok(a1['id']==a2['id'],'same Idempotency-Key -> same murojaat (no duplicate)')
