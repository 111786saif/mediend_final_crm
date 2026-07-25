/**
 * Default editable letter bodies with {{placeholders}}.
 * Wrapped with letterhead/styles via buildDocumentHtml at render time.
 */

export const DOCUMENT_TEMPLATE_NAMES: Record<string, string> = {
  OFFER_LETTER: 'Offer Letter',
  INCREMENT_LETTER: 'Increment Letter',
  EXPERIENCE_LETTER: 'Experience Letter',
  RELIEVING_LETTER: 'Relieving Letter',
  INTERNSHIP_OFFER_LETTER: 'Internship Offer Letter',
  INTERNSHIP_COMPLETION_LETTER: 'Internship Completion Certificate',
  EXIT_INTERVIEW_FORM: 'Exit Interview Form',
}

export const DEFAULT_TEMPLATE_BODIES: Record<string, string> = {
  OFFER_LETTER: `
  <div class="date">
    <p>Date: {{today}}</p>
    <p>Ref: {{refNumber}}</p>
  </div>

  <div>
    <p><strong>To,</strong></p>
    <p>{{salutation}} {{employeeName}}{{guardianLine}}</p>{{addressBlock}}
    <p>Email: {{employeeEmail}}</p>
  </div>

  <div class="subject">OFFER LETTER</div>

  <div class="content">
    <p>Dear {{employeeName}},</p>

    <p>With reference to your interview for seeking employment with the organization, we are pleased to offer you the post of <strong>{{designation}}</strong> in the <strong>{{department}}</strong> Department with Kundkund Healthcare Pvt. Ltd. We are delighted to make you the following job offer.</p>

    <p>The position we are offering you is at Gross Monthly Salary of INR {{monthlySalary}} with an annual cost to company INR {{ctc}} ({{ctcWords}} Rupees Only) (Including TDS as per Govt Rule of India) (Individual Medical Insurance, Employee &amp; Employer Provident Fund portion will be a part of your cost to company if opted).</p>

    <p>You will be paid your salary monthly after giving effect to withholding(s) as required by law. Any Income Tax applicable on your remuneration or any other payment made by the Company in respect to taxes will be borne by you and as required by law, will be deducted at source.</p>

    <p>Your hours of work will be as per the Company policy and requirement of the project you are working on. You shall always be subject to overall policy of the company and agree to be bound by the same.</p>

    <p>This position is offered subject to satisfactory reference and pre-employment checks by third party vendors/Kundkund Healthcare and completion of Six-month probation period during which time your performance will be reviewed.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Non-Solicitation and Non-Hire of Company Employees</h4>
    <p>You agree that during the term of your employment and a further period of 12 (twelve) calendar months after separation from the Company, for whatever reasons, you shall not either directly or indirectly solicit or entice away or endeavor to solicit or to entice away or assist any other person to solicit or hire or entice away from the Company, any Company employee.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Confidentiality &amp; Non-Compete and Non-Solicitation</h4>
    <p>You agree not to share your salary or any confidential company information, not to join any competitor as an employee or contractor, and not to solicit any employee of the Company to join another organization.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Transfer &amp; Relocation</h4>
    <p>You may be transferred in such capacity as the company may from time to time determine to any other location, department, establishment, factory or branch of the company or its affiliate, associate or subsidiary companies. You agree that you are willing to travel to such places, within or outside India, as the Company may from time to time require in relation to Company's business.</p>

    <p>All information, data and documents shared by the Company with you are the intellectual property of the Company and you will at all times maintain the confidentiality of all the information, data and documents shared with you, including this offer letter.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Confidentiality &amp; Integrity Issue</h4>
    <p>The Employee shall not disclose, at any time to any person who is not employed, part of or associated with the Company; or use for any purpose that is not within the scope of his services, any Confidential Information. The Employee shall not be a part of same business involvement/Freelancing while working with Kundkund Healthcare. The Employee shall not be a part of sharing Kundkund Healthcare business leads outside the company with any of the person/Doctor/Hospital. In such cases employee can be asked to leave the company with immediate effect without salary.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Termination of Employment</h4>
    <p>Termination of the employment for "cause": The Company may terminate Employee's employment without notice in the event of non-performance, willful or serious misconduct on Employee's part. Termination in case the Employee is absconding from work: In case the Employee is absent from his official duty continuously for 3 (Three) or more days without any information, the Employee shall be deemed to have left and relinquished the service on his own accord.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Probation</h4>
    <p>The Employee has to pursue 6 Months' probation period with the Kundkund Healthcare. During Probation period your notice period would be of 15 Days.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Leaves Under Probation</h4>
    <p>Casual Leave: 6 Leaves (1 per month), Sick Leave: 3 Leaves (0.5 per month), Earned Leave: 3 Leaves (1 per month) - credited after successful completion of 6 months' probation period.</p>
    {{salesSection}}

    <p>Initially, you will be posted at our Noida office (Address: 6th Floor, Plot No. 56A/16, Block C, Phase 2, Industrial Area, Sector 62, Noida, Uttar Pradesh 201309). This position reports to HOD. Your working hours will be intimated by your reporting manager.</p>

    <p>We would like you to start work on <strong>{{joiningDate}}</strong>. If this date is not acceptable, please contact undersigned immediately.</p>

    <p>Please sign the enclosed copy of this letter and return it to undersigned by <strong>{{acceptanceDeadline}}</strong> to indicate your acceptance of this offer.</p>

    <p>We are confident you will be able to make a significant contribution to the success of our Kundkund Healthcare Limited and look forward to working with you.</p>
  </div>

  <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <p>Sincerely</p>
      {{signatureHtml}}
    </div>
    <div style="text-align: right;">
      <p><strong>Employee Acceptance</strong></p>
      <p>Signature: _________________</p>
      <p>Date: _________________</p>
    </div>
  </div>

  <div style="margin-top: 40px; border-top: 1px dashed #999; padding-top: 20px;">
    <p><strong>Acceptance:</strong></p>
    <p>I, {{employeeName}}{{guardianLine}}{{addressAcceptance}}, hereby accept the offer of employment as mentioned above.</p>
    <!-- ACK_PLACEHOLDER -->
  </div>
`,

  INCREMENT_LETTER: `
  <div class="date">
    <p>Date: {{today}}</p>
    <p>Ref: {{refNumber}}</p>
  </div>

  <div>
    <p><strong>To,</strong></p>
    <p>{{salutation}} {{employeeName}}</p>
    <p>Employee ID: {{employeeCode}}</p>
    <p>Department: {{department}}</p>
  </div>

  <div>
    <p><strong>Company - {{companyName}}</strong></p>
    <p>Add - {{companyAddress}}</p>
  </div>

  <div class="subject">SALARY INCREMENT LETTER</div>

  <div class="content">
    <p>Dear {{employeeName}},</p>

    <p>As we reflect on the progress and achievements over the past year, it brings me immense joy to acknowledge your contributions to Kundkund Healthcare Pvt Ltd. Since joining us as a <strong>{{designation}}</strong> on {{joinDate}}, your exemplary performance and unwavering commitment have played a pivotal role in driving our mission forward.</p>

    <p>Your remarkable ability to foster relationships, identify new opportunities, and execute strategic initiatives has not only exceeded expectations but has also made a significant impact on our team and the company's growth trajectory. Your contributions resonate with our core values, and we are truly grateful to have you on board.</p>

    <p>In recognition of your hard work and dedication, we are excited to announce a salary increment of <strong>{{incrementPercentage}}%</strong>, effective from <strong>{{effectiveDate}}</strong>. Your new monthly salary will be <strong>INR {{newMonthlySalary}}</strong> (Annual CTC: {{newSalaryFormatted}}). This increment reflects not just your past performance but also our confidence in your future contributions to our success.</p>

    {{remarksBlock}}

    <p>At Kundkund Healthcare, we are committed to fostering a culture of excellence and continuous improvement, and we are thrilled to support your professional journey. We look forward to witnessing your continued growth and the positive impact you will undoubtedly make in the future.</p>

    <p>Congratulations on this well-deserved recognition! Let's continue to achieve great things together.</p>
  </div>

  {{signatureHtml}}
`,

  EXPERIENCE_LETTER: `
  <div class="date">
    <p>Date: {{today}}</p>
    <p>Ref: {{refNumber}}</p>
  </div>

  <div class="subject">EXPERIENCE CERTIFICATE</div>

  <div class="content">
    <p><strong>TO WHOMSOEVER IT MAY CONCERN</strong></p>

    <p>This is to certify that {{salutation}} <strong>{{employeeName}}</strong> was employed with Kundkund Healthcare Pvt. Ltd. from <strong>{{joinDate}}</strong> to <strong>{{lastWorkingDate}}</strong> in the capacity of <strong>{{designation}}</strong>.</p>

    <p>During the tenure with our organization, {{firstName}} demonstrated a high level of professionalism, commitment, and responsibility in carrying out assigned duties. {{firstName}} consistently displayed strong work ethics, effective communication skills, and the ability to work both independently and as part of a team.</p>

    <p>His/Her contribution to the organization was valuable, and performance throughout the employment period was found to be commendable. {{firstName}} maintained excellent conduct and adhered to company policies and standards at all times.</p>

    <p>This letter is being issued upon the employee's request for professional and official purposes.</p>

    <p>We appreciate his/her contributions and wish him/her continued success in all future professional endeavors.</p>
  </div>

  <div style="margin-top: 40px;">
    <p>For Kundkund Healthcare Pvt. Ltd.</p>
    {{signatureHtml}}
  </div>
`,

  RELIEVING_LETTER: `
  <div class="date">
    <p>Date: {{today}}</p>
    <p>Ref: {{refNumber}}</p>
  </div>

  <div class="subject">RELIEVING LETTER</div>

  <div class="content">
    <p><strong>{{employeeName}}</strong></p>
    <p>Employee Code: {{employeeCode}}</p>
    <br>

    <p>Dear {{employeeName}},</p>

    <p>With reference to your resignation letter dated <strong>{{resignationDate}}</strong>, we hereby confirm that you have been relieved from your duties as <strong>{{designation}}</strong> at {{companyName}} with effect from <strong>{{lastWorkingDate}}</strong>.</p>

    <p>During your tenure from <strong>{{joinDate}}</strong> to <strong>{{lastWorkingDate}}</strong>, your services were found satisfactory.</p>

    <p>You have completed all handover formalities and cleared all company dues. There are no financial or material obligations pending from your side.</p>

    <p>We thank you for your contributions to the organization and wish you success in your future endeavors.</p>
  </div>

  <div style="margin-top: 40px;">
    <p>For {{companyName}}</p>
    {{signatureHtml}}
  </div>
`,

  INTERNSHIP_OFFER_LETTER: `
  <div class="date">
    <p>Date: {{today}}</p>
    <p>Ref: {{refNumber}}</p>
  </div>

  <div>
    <p><strong>To,</strong></p>
    <p>{{salutation}} {{employeeName}}{{guardianLine}}</p>{{addressBlock}}
    <p>Email: {{employeeEmail}}</p>
  </div>

  <div class="subject">INTERNSHIP OFFER LETTER</div>

  <div class="content">
    <p>Dear {{employeeName}},</p>

    <p>We are pleased to extend to you an offer for an internship position at <strong>{{companyName}}</strong> as a <strong>{{designation}}</strong>. This internship is scheduled to begin on <strong>{{startDate}}</strong>.</p>

    <h4 style="margin-top: 24px; margin-bottom: 8px;">Details of the Internship</h4>

    <table class="details-table">
      <tr><td>Position</td><td>{{designation}}</td></tr>
      <tr><td>Duration of Internship</td><td>{{duration}}</td></tr>
      <tr><td>Department</td><td>{{department}}</td></tr>
      <tr><td>Location</td><td>{{location}}</td></tr>
      <tr><td>Compensation</td><td>{{stipendDisplay}}</td></tr>
      <tr><td>Type of Internship</td><td>{{internshipType}}</td></tr>
    </table>

    <p>During the internship, you will be expected to adhere to the company's rules, regulations, and policies. You shall maintain strict confidentiality regarding all proprietary information of the company.</p>

    <p>Please confirm your acceptance by signing and returning this letter by <strong>{{acceptanceDeadline}}</strong>. We look forward to having you on our team!</p>
  </div>

  <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <p>Sincerely</p>
      {{signatureHtml}}
    </div>
    <div style="text-align: right;">
      <p><strong>Intern Acceptance</strong></p>
      <p>Signature: _________________</p>
      <p>Date: _________________</p>
    </div>
  </div>

  <div style="margin-top: 40px; border-top: 1px dashed #999; padding-top: 20px;">
    <p><strong>Acceptance:</strong></p>
    <p>I, {{employeeName}}{{guardianLine}}{{addressAcceptance}}, hereby accept the offer of internship as mentioned above.</p>
    <!-- ACK_PLACEHOLDER -->
  </div>
`,

  INTERNSHIP_COMPLETION_LETTER: `
  <div class="date">
    <p>Date: {{today}}</p>
    <p>Ref: {{refNumber}}</p>
  </div>

  <div class="subject">INTERNSHIP COMPLETION CERTIFICATE</div>

  <div class="content">
    <p><strong>TO WHOMSOEVER IT MAY CONCERN</strong></p>

    <p>We are glad to inform that {{salutation}} <strong>{{employeeName}}</strong> has successfully completed the internship at <strong>{{companyName}}</strong> from <strong>{{startDate}}</strong> to <strong>{{endDate}}</strong>.</p>

    <p>During the internship, {{firstName}} was exposed to the various activities in the <strong>{{department}}</strong> Department.</p>

    <p>We found {{firstName}} extremely inquisitive and hard working. {{firstName}} was very much interested to learn the functions of our core division and was willing to put the best efforts and get into the depth of the subject to understand it better.</p>

    <p>The association with us was very fruitful and we wish {{firstName}} all the best in future endeavors.</p>
  </div>

  <div style="margin-top: 40px;">
    <p>For {{companyName}}</p>
    <p>Thanks &amp; Regards</p>
    {{signatureHtml}}
  </div>
`,

  EXIT_INTERVIEW_FORM: `
  <div class="subject">EXIT INTERVIEW FORM</div>
  <p style="text-align:center;margin-bottom:16px;font-size:13px;color:#64748b;">Date: {{today}}</p>

  <div class="exit-section">
    <h3>Employee Information</h3>
    <p class="exit-field"><label>Name:</label> <span class="val exit-underline">{{employeeName}}</span></p>
    <p class="exit-field"><label>Employee ID:</label> <span class="val exit-underline">{{employeeCode}}</span></p>
    <p class="exit-field"><label>Department:</label> <span class="val exit-underline">{{department}}</span></p>
    <p class="exit-field"><label>Position:</label> <span class="val exit-underline">{{designation}}</span></p>
    <p class="exit-field"><label>Date of Joining:</label> <span class="val exit-underline">{{joinDate}}</span></p>
    <p class="exit-field"><label>Last Working Day:</label> <span class="val exit-underline">{{lastWorkingDate}}</span></p>
  </div>

  <div class="exit-section">
    <h3>Exit Interview Questions</h3>
    <p class="exit-field"><label>1. Reason for Leaving:</label></p>
    <p style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;min-height:32px;">{{reasonForLeaving}}</p>

    <p class="exit-field" style="margin-top:16px;"><label>2. Job Role — Matched Expectations?</label> <span class="compact-check-label">{{jobRoleMatch}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{jobRoleComments}}</span></p>

    <p class="exit-field" style="margin-top:16px;"><label>3. Work Environment:</label> <span class="compact-check-label">{{workEnvironment}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{workEnvironmentComments}}</span></p>

    <p class="exit-field" style="margin-top:16px;"><label>4. Company Culture:</label> <span class="compact-check-label">{{companyCulture}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{companyCultureComments}}</span></p>

    <p class="exit-field" style="margin-top:16px;"><label>5. Suggestions for Improvement:</label></p>
    <p style="padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;min-height:32px;">{{suggestions}}</p>

    <p class="exit-field" style="margin-top:16px;"><label>6. Notice Period Served:</label> <span class="compact-check-label">{{noticePeriodServed}}</span></p>
    <p class="exit-field"><label>Days / Reason:</label> <span class="val">{{noticePeriodDetail}}</span></p>
  </div>

  <div class="exit-section">
    <h3>Handover &amp; Exit Process</h3>
    <p class="exit-field"><label>7. Handover Completed:</label> <span class="compact-check-label">{{handoverCompleted}}</span></p>
    <p class="exit-field"><label>Reason:</label> <span class="val">{{handoverReason}}</span></p>
  </div>

  <div class="exit-section">
    <h3>Digital Department Clearance</h3>
    <p class="exit-field"><label>Email Access Removed:</label> <span class="compact-check-label">{{emailAccessRemoved}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{emailAccessComments}}</span></p>
    <p class="exit-field" style="margin-top:8px;"><label>Other Access Removed:</label> <span class="compact-check-label">{{otherAccessRemoved}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{otherAccessComments}}</span></p>
  </div>

  <div class="exit-section">
    <h3>Admin Department Clearance</h3>
    <p class="exit-field"><label>ID Cards Returned:</label> <span class="compact-check-label">{{idCardsReturned}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{idCardsComments}}</span></p>
    <p class="exit-field" style="margin-top:8px;"><label>SIM Cards Returned:</label> <span class="compact-check-label">{{simCardsReturned}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{simCardsComments}}</span></p>
    <p class="exit-field" style="margin-top:8px;"><label>Other Assets Returned:</label> <span class="compact-check-label">{{workAssetsReturned}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{workAssetsComments}}</span></p>
  </div>

  <div class="exit-section">
    <h3>Sales Head Confirmation</h3>
    <p class="exit-field"><label>Backup Handover Received:</label> <span class="compact-check-label">{{backupReceived}}</span></p>
    <p class="exit-field"><label>Remarks:</label> <span class="val">{{backupRemarks}}</span></p>
  </div>

  <div class="exit-section">
    <h3>HR Remarks</h3>
    <p class="exit-field"><label>Exit Process Completed:</label> <span class="compact-check-label">{{hrExitCompleted}}</span></p>
    <p class="exit-field"><label>Remarks:</label> <span class="val">{{hrRemarks}}</span></p>
  </div>

  <div class="exit-section">
    <h3>Return of Company Property</h3>
    <p>{{propertyTable}}</p>
  </div>

  <div class="exit-section">
    <h3>Additional Remarks</h3>
    <p class="exit-field"><label>Would consider for future hiring?</label> <span class="compact-check-label">{{wouldConsiderFuture}}</span></p>
    <p class="exit-field"><label>Comments:</label> <span class="val">{{wouldConsiderComments}}</span></p>
  </div>

  <div style="margin-top:40px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center;color:#166534;">
    <p style="margin:0;"><strong>Acknowledged by Employee</strong></p>
    <p style="margin:4px 0 0;">Signature: _________________ &nbsp;&nbsp;&nbsp; Date: _________________</p>
  </div>
`,
}

export const TEMPLATE_EXTRA_STYLES: Record<string, string> = {
  INTERNSHIP_OFFER_LETTER: `
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table td { padding: 8px 12px; border: 1px solid #ddd; }
    .details-table td:first-child { font-weight: bold; width: 40%; background: #f8fafc; }
  `,
  EXIT_INTERVIEW_FORM: `
    .exit-section { margin: 24px 0; }
    .exit-section h3 { font-size: 15px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    .exit-field { margin: 8px 0; }
    .exit-field label { font-weight: bold; display: inline-block; min-width: 220px; }
    .exit-field .val { display: inline; }
    .exit-underline { border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px; }
    .compact-check-label { font-weight: 600; font-size: 13px; margin-right: 8px; }
  `,
}
