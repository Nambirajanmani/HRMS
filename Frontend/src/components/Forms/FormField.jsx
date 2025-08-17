import { Controller } from 'react-hook-form';
import { forwardRef, useCallback } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Textarea from '../UI/Textarea';
import Checkbox from '../UI/Checkbox';
import Switch from '../UI/Switch';

const FormField = forwardRef(({
  name,
  control,
  type = 'text',
  label,
  placeholder,
  required = false,
  options = [],
  rows,
  description,
  helperText,
  rules = {},
  disabled = false,
  ...props
}, ref) => {
  
  // Memoized field renderer
  const renderField = useCallback(({ field, fieldState }) => {
    const commonProps = {
      ...field,
      ...props,
      label,
      required,
      disabled,
      error: fieldState.error?.message,
      helperText,
      ref,
    };

    switch (type) {
      case 'select':
        return (
          <Select {...commonProps} placeholder={placeholder}>
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            placeholder={placeholder}
            rows={rows}
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            {...commonProps}
            label={label}
            description={description}
            checked={field.value}
          />
        );

      case 'switch':
        return (
          <Switch
            {...commonProps}
            label={label}
            description={description}
            checked={field.value}
          />
        );

      default:
        return (
          <Input
            {...commonProps}
            type={type}
            placeholder={placeholder}
          />
        );
    }
  }, [type, label, placeholder, required, options, rows, description, helperText, disabled, props, ref]);

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={renderField}
    />
  );
});

FormField.displayName = 'FormField';

export default FormField;