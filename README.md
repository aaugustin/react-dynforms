# react-dynforms

`react-dynforms` is (yet another) forms framework for React. It attemps to
follow the philosophy of React. It's designed for highly dynamic forms, whose
validation rules for a field can depend heavily on the values of other fields.

## Example

```jsx
import Form, { FormDisplayPropTypes } from 'react-dynforms'

const signUpFormFields = {
  email: {
    label: "Email",
  },
  password1: {
    label: "Password",
    validators: [
      (password1) => {
        if (password1.length < 8) {
          return "Passwords is too short."
        }
      },
    ],
  },
  password2: {
    label: "Confirm password",
    validators: [
      (password2, {password1}) => {
        if (password2 && password2 !== password1) {
          return "Passwords do not match."
        }
      },
    ],
  },
}

const SignUpFormDisplay = ({
  isValid,
  fields: {
    email,
    password1,
    password2,
  },
  handleSubmit,
  isSubmitting,
}) => (
  <form onSubmit={handleSubmit}>
    <label>
      {email.label}
      <input type="text" onChange={email.onChange} value={email.value} />
      {email.error}
    </label>
    <br />
    <label>
      {password1.label}
      <input type="password" onChange={password1.onChange} value={password1.value} />
      {password1.error}
    </label>
    <br />
    <label>
      {password2.label}
      <input type="password" onChange={password2.onChange} value={password2.value} />
      {password2.error}
    </label>
    {
      isSubmitting
        ? "Signing up..."
        : <input type="submit" value="Sign up" disabled={!isValid} />
    }
  </form>
)

SignUpFormDisplay.propTypes = FormDisplayPropTypes

class SignUpForm extends React.Component {

  handleSubmit = (values, form) => {
    // Call the API sign-up endpoint
    signUp(values)
    .then(data => {
      if (data.errors) {
        form.setErrorLists(data.errors)
      } else {
        // Success!
      }
    })
    .catch((exc) => window.console.error(exc))
  }

  render = () => (
    <Form
      component={SignUpFormDisplay}
      fields={signUpFormFields}
      handleSubmit={this.handleSubmit}
    />
  )

}
```

## `Form`

The `Form` component exported by `dynforms` is a container component that
factors out common behavior of form components. It knows how to format values,
enforce choices, and perform validation.

In order to create a form, you need:

* a description of its fields,
* a function to handle submissions,
* a display component to render the form.

We'll talk about each of these now.

### Fields

You must define fields with the `fields` prop of `Form`. It's an object
whose keys are field names and values are field definitions.

The definition of each field is an object that may contain the following
values — all of them are optional:

* `label`: a short string describing the field. Defaults to `undefined`.

* `initial`: the initial value of the field. Defaults to the empty string
  (`''`).

* `readonly`: whether modifications to the value of the field are prevented.
  Defaults to `false`.

  When `readonly` is set to `true`, a value should be provided with `initial`,
  or the field will remain empty.

* `required`: whether the field must contain a non-empty value. Defaults to
  `true`.

  This can be either a boolean or a function that receives a `values` argument
  containing the values of all fields. The latter allows making some fields
  required depending on the values of other fields.

* `formatter`: a function to normalize the formatting of values. Defaults to
  `undefined`.

  Formatters receive two arguments: the new value and the previous value. They
  return a normalized value as a string.

  The normalized value replaces the new value. If the new value cannot be
  normalized, typically because the user hasn't finished typing it, the
  formatter must return it unchanged, or else it will be lost.

  When a formatter changes the value in an `<input>` field, the caret jumps to
  the end of the field. Workarounds exist but they aren't trivial. Excessively
  smart formatting logic often backfires; keep it simple.

* `validators`: an array of functions to validate values on the client side.
  Defaults to an empty array.

  Validators receive the formatted value as a string and return a string
  describing the error if the value is invalid or a falsy value such as
  `undefined` if the value is valid.

  Validators don't run when the value is the empty string to avoid showing
  error messages for every field when a form is initially rendered. Required
  fields should be marked as such based on `field.required` and possibly on
  `!field.value`.

* `choices`: an array of `{code, display}` objects. Defaults to
  `undefined`.

  `code` is stored by the form; `display` is shown to the user. `Form`
  doesn't do anything with this option. It's intended for select widgets.

### Submission

You must define a callback with the `handleSubmit` prop of `Form`. It's a
function that receives the values and the form instance in argument. Values are
represented by an object whose keys are field names and values are, well, values.

Individual values are strings. `handleSubmit` is expected to perform type
conversions as needed.

`handleSubmit` must return a `Promise` that will be fulfilled when the
submission is fully processed. If the `Promise` is rejected, the form will
remain stuck in the "submitting" state. Make sure you handle exceptions!

Usually `handleSubmit` will submit the values to the server — client-side
validation was already performed by the form — and, depending on the results,
call methods on the form to update its state.

* `form.setErrorLists({fieldName: ['Error 1.', 'Error 2.', ...], ...})` sets
  validation errors returned by the server. This overrides previous errors.
  `form.setErrorLists({})` clears server-side validation errors.

* `form.setValues({fieldName: fieldValue, ...}, callback)` modifies values
  displayed by the form. New values are merged with current values.
  `form.setValues({fieldName: undefined})` reverts to the initial value.

The public API of form instances only contains these two methods.

### Display component

You must define the display component with the `component` prop of `Form`.

The display component receives the following `props`:

* `fields`: an object describing the form fields. Keys are names of fields
  and values are objects that contain all the values described above, in the
  definition of fields, plus the following, which are computed by the form:

  * `name`: the name of the field,

  * `error`: a string describing the error if the current value isn't
    valid, `null` if it is,

  * `value`: the current value of the field: something the user entered
    or the initial value,

  * `onChange(event, callback)`: a function that must be called when the
    user changes the value of the field; when it's called, the form runs
    formatting and validation, then calls the callback if there is one.

  Other keys included in field definitions are passed through unchanged. For
  example, this allows setting HTML attributes such as `autoComplete` in the
  field definition rather than in the display component.

* `globalError`: a string describing a global error if the form failed
  server-side validation for a reason not tied to a particular field.

* `isValid`: a boolean that tells whether the form passed client-side
  validation and can be submitted. The submission button should be disabled
  when it's `false`.

* `isSubmitting`: a boolen that tells whether the form is being submitted.
  A progress indicator should be shown instead of the submission button when
  it's `true`.

* `handleSubmit`: an event handler that must be called when the form is
  submitted, as described above.

You can pass other props to the display component with the `componentProps`
prop of `Form`. It's just a shortcut that avoids creating a closure merely to
inject additional props into the display component.

### Limitations

You can't have a field called `all`. By convention, this name is reserved for
global errors reported by server-side validation.

There's no support for global errors in client-side validation at this time. I
could add it if I had a use case.

### Changelog

* 1.0.0

  * Initial public release
