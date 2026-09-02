export function renderAutomationTemplate(
  template: string,
  values: {
    patientName: string;
    businessName: string;
    appointmentDate: string;
  },
) {
  return template
    .replaceAll('{{patient_name}}', values.patientName)
    .replaceAll('{{business_name}}', values.businessName)
    .replaceAll('{{appointment_date}}', values.appointmentDate);
}
