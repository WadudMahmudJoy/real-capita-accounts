async (root) => {
  const f = __FIXTURE__, browser = root.context().browser(), contexts = []; let checks = 0;
  const check = (value, message) => {if (!value) throw Error(message); checks++;};
  try {
    const context = await browser.newContext({viewport: {width:1280,height:950}}); contexts.push(context);
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    await page.goto(f.url+'/login');
    await page.getByLabel('Email',{exact:true}).fill(f.email);
    await page.getByLabel('Password',{exact:true}).fill(f.password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click(); await page.waitForURL('**/app');
    await page.goto(f.url+'/app/users'); await page.getByRole('heading',{name:'Leadership onboarding',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Your verification state',exact:true}).waitFor(); check(true,'Authenticated onboarding state renders');
    check((await context.request.get(f.api+'/onboarding/status')).status()===200,'Authenticated safe status API');
    check(await page.getByText('Pending requests grant no permissions.',{exact:false}).count()>0,'No authority from pending requests');
    check(await page.getByText('The authorizer’s company authorization must exist independently',{exact:false}).count()>0,'Independent company authorization checklist');
    const invitation = page.getByRole('button',{name:'Request private invitation verification',exact:true});
    if(await invitation.count()) check(await invitation.isDisabled(),'Incomplete/unconfigured invitation cannot dispatch');
    await page.setViewportSize({width:390,height:844});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile onboarding layout');
    const anonymous = await browser.newContext({viewport:{width:390,height:844}}); contexts.push(anonymous);
    const claim = await anonymous.newPage();
    check((await anonymous.request.get(f.api+'/onboarding/status')).status()===401,'Anonymous onboarding status denied');
    await claim.goto(f.url+'/claim'); await claim.getByRole('heading',{name:'Claim your individual account',exact:true}).waitFor();
    check(await claim.getByRole('button',{name:'Verify account control',exact:true}).isDisabled(),'Absent capability cannot claim');
    await claim.goto(f.url+'/claim#capability=synthetic-invalid-capability');
    await claim.getByLabel('New individual password',{exact:true}).fill('SyntheticFixtureOnly-839!');
    check(!claim.url().includes('#'),'Capability removed from browser URL');
    const response = claim.waitForResponse(r=>r.url()===f.api+'/onboarding/claim'&&r.request().method()==='POST');
    await claim.getByRole('button',{name:'Verify account control',exact:true}).click();
    check([400,401,403,409,503].includes((await response).status()),'Invalid/unconfigured claiming fails closed');
    await claim.getByRole('status').waitFor();
    check(await claim.getByLabel('New individual password',{exact:true}).inputValue()==='','Password cleared after claim attempt');
    check(await claim.getByRole('button',{name:'Verify account control',exact:true}).isDisabled(),'Consumed local capability cannot retry');
    check(await claim.locator('meta[name="referrer"]').getAttribute('content')==='no-referrer','Claim referrer protection');
    check(await claim.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile claim layout');
    check((await anonymous.request.get(f.api+'/auth/me')).status()===401,'Rejected claim creates no authenticated elevated session');
    return {status:'PASS',checks};
  } catch (error) {return {status:'FAIL',checks,message:String(error)};}
  finally {for(const context of contexts) await context.close();}
}
