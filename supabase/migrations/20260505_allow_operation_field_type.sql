alter table public.pdf_template_fields
drop constraint if exists pdf_template_fields_field_type_check;

alter table public.pdf_template_fields
add constraint pdf_template_fields_field_type_check
check (
  field_type in (
    'text',
    'textarea',
    'number',
    'date',
    'time',
    'serial_number',
    'select',
    'checkbox',
    'signature',
    'operation'
  )
);
