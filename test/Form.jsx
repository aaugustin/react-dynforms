import React from 'react'
import { expect } from 'chai'
import { shallow } from 'enzyme'

import Form from '../src/Form'

describe("Form", () => {

    const FormDisplay = () => {}

    const renderForm = (fields, otherProps) => {
        return shallow(
            <Form
                component={FormDisplay}
                fields={fields}
                handleSubmit={() => {}}
                {...otherProps}
            />
        )
    }

    const renderFormWithValidators = () => {
        return renderForm({
            email: {
                validators: [
                    (value) => {
                        if (value.indexOf('@') === -1) {
                            return "This doesn't look like an email."
                        }
                    },
                    (value) => {
                        if (value !== value.toLowerCase()) {
                            return "Who has an upper-case email?"
                        }
                    },
                ],
            },
        })
    }

    const renderFormWithOptionalField = () => {
        return renderForm({
            email: {
                validators: [
                    (value) => {
                        if (value.indexOf('@') === -1) {
                            return "This doesn't look like an email."
                        }
                    },
                ],
            },
            password: {
            },
            name: {
                required: false,
            },
        })
    }

    it("renders the display component", () => {
        const wrapper = renderForm()
        const formDisplay = wrapper.find(FormDisplay)
        expect(formDisplay).to.have.length(1)
    })

    it("passes through unknown field properties", () => {
        const wrapper = renderForm({
            email: {
                autoComplete: 'email',
            },
        })
        const email = wrapper.prop('fields').email
        expect(email.autoComplete).to.equal('email')
    })

    it("defaults initial field values to the empty string", () => {
        const wrapper = renderForm({
            email: {},
        })
        const email = wrapper.prop('fields').email
        expect(email.value).to.equal('')
    })

    it("sets initial field values", () => {
        const wrapper = renderForm({
            email: {
                initial: 'john.doe@example.com',
            },
        })
        const email = wrapper.prop('fields').email
        expect(email.value).to.equal('john.doe@example.com')
    })

    it("changes field values", () => {
        const wrapper = renderForm({
            email: {},
        })
        let email
        email = wrapper.prop('fields').email
        email.onChange({target: {value: 'john.doe@example.com'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.value).to.equal('john.doe@example.com')
        email.onChange({target: {value: 'jane.dane@example.com'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.value).to.equal('jane.dane@example.com')
    })

    it("ignores attemps to change readonly field values", () => {
        const wrapper = renderForm({
            email: {
                initial: 'john.doe@example.com',
                readonly: true,
            },
        })
        let email
        email = wrapper.prop('fields').email
        email.onChange({target: {value: 'jane.dane@example.com'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.value).to.equal('john.doe@example.com')
    })

    it("marks fields as required by default", () => {
        const wrapper = renderForm({
            email: {
            },
            password: {
                required: false,
            },
        })
        const email = wrapper.prop('fields').email
        expect(email.required).to.be.true
        const password = wrapper.prop('fields').password
        expect(password.required).to.be.false
    })

    it("can mark a field as required depending on other fields", () => {
        const wrapper = renderForm({
            email: {
                required: true,     // that's the default.
            },
            password: {
                required: ({email}) => (!email.endsWith('@company.com')),
            },
        })

        let email, password

        // In this example, password is mandatory for external users...

        email = wrapper.prop('fields').email
        email.onChange({target: {value: 'john.doe@example.com'}})
        wrapper.update()
        password = wrapper.prop('fields').password
        expect(password.required).to.be.true

        // ... and optional for internal users -- assume SSO or something.

        email = wrapper.prop('fields').email
        email.onChange({target: {value: 'john.doe@company.com'}})
        wrapper.update()
        password = wrapper.prop('fields').password
        expect(password.required).to.be.false
    })

    it("runs validators and shows client-side errors on invalid inputs", () => {
        const wrapper = renderFormWithValidators()

        let email
        email = wrapper.prop('fields').email

        // Show a single error.

        email.onChange({target: {value: 'John.Doe@example.com'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("Who has an upper-case email?")

        // Show multiple errors.

        email.onChange({target: {value: 'John.Doe'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("This doesn't look like an email. " +
                                    "Who has an upper-case email?")

    })

    it("runs validators and shows no client-side errors on valid inputs", () => {
        const wrapper = renderFormWithValidators()

        let email
        email = wrapper.prop('fields').email

        // Set a valid value.

        email.onChange({target: {value: 'john.doe@example.com'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal(null)

        // Set an invalid value to show an error.

        email.onChange({target: {value: 'john.doe'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("This doesn't look like an email.")

        // Setting a valid value removes the error.

        email.onChange({target: {value: 'john.doe@example.com'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal(null)

    })

    it("runs validators and shows no client-side errors on empty inputs", () => {
        const wrapper = renderFormWithValidators()

        let email
        email = wrapper.prop('fields').email

        // The initial empty value doesn't show an error
        // (even though it's invalid -- it doesn't contain an @).

        expect(email.value).to.equal('')
        expect(email.error).to.equal(null)

        // Set an invalid value to show an error.

        email.onChange({target: {value: 'john.doe'}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("This doesn't look like an email.")

        // Setting an empty value removes the error.

        email.onChange({target: {value: ''}})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal(null)
    })

    it("shows server-side errors", () => {
        const wrapper = renderFormWithValidators()

        let email
        email = wrapper.prop('fields').email

        // Set a valid value for client-side validation.

        email.onChange({target: {value: 'john.doe@example.com'}})
        wrapper.update()

        // Show a single error.

        wrapper.instance().setErrorLists({'email': ["No examples, please."]})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("No examples, please.")

        // Show multiple errors.

        wrapper.instance().setErrorLists(
            {'email': ["No examples, please.", "I'm not kidding."]})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("No examples, please. I'm not kidding.")
    })

    it("clears server-side errors", () => {
        const wrapper = renderFormWithValidators()

        let email
        email = wrapper.prop('fields').email

        // Set a valid value for client-side validation.

        email.onChange({target: {value: 'john.doe@example.com'}})
        wrapper.update()

        // Show an error.

        wrapper.instance().setErrorLists({'email': ["No examples, please."]})
        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("No examples, please.")
    })

    it("shows both client-side and server-side errors", () => {
        const wrapper = renderFormWithValidators()

        let email
        email = wrapper.prop('fields').email

        // Set an invalid value for client-side validation and a server-side
        // validation error.

        email.onChange({target: {value: 'john.doe at example.com'}})
        wrapper.instance().setErrorLists({'email': ["No examples, please."]})

        // Add a server-side validation error.

        wrapper.update()
        email = wrapper.prop('fields').email
        expect(email.error).to.equal("This doesn't look like an email. No examples, please.")

    })

    it("sets isValid when submission is possible", () => {
        const wrapper = renderFormWithOptionalField()

        let email, password, name, isValid
        email = wrapper.prop('fields').email
        password = wrapper.prop('fields').password
        name = wrapper.prop('fields').name

        // Set valid values.

        email.onChange({target: {value: 'john.doe@example.com'}})
        password.onChange({target: {value: 'hunter2'}})

        wrapper.update()
        isValid = wrapper.prop('isValid')
        expect(isValid).to.be.true

        // Remove a required value.

        password = wrapper.prop('fields').password
        password.onChange({target: {value: ''}})

        wrapper.update()
        isValid = wrapper.prop('isValid')
        expect(isValid).to.be.false

        // Restore required value.

        password = wrapper.prop('fields').password
        password.onChange({target: {value: 'hunter2'}})

        wrapper.update()
        isValid = wrapper.prop('isValid')
        expect(isValid).to.be.true

        // Set an invalid value.

        email = wrapper.prop('fields').email
        email.onChange({target: {value: 'john.doe'}})

        wrapper.update()
        isValid = wrapper.prop('isValid')
        expect(isValid).to.be.false

        // Restore valid value

        email = wrapper.prop('fields').email
        email.onChange({target: {value: 'john.doe@example.com'}})

        wrapper.update()
        isValid = wrapper.prop('isValid')
        expect(isValid).to.be.true

        // Optional values are ignored

        name = wrapper.prop('fields').name
        name.onChange({target: {value: 'Jean Dupont'}})

        wrapper.update()
        isValid = wrapper.prop('isValid')
        expect(isValid).to.be.true
    })

    it("doesn't set isSubmitting during a synchronous submission", () => {
        const wrapper = renderForm({
        }, {
            handleSubmit: () => {},
        })

        let isSubmitting, handleSubmit

        isSubmitting = wrapper.prop('isSubmitting')
        expect(isSubmitting).to.be.false

        handleSubmit = wrapper.prop('handleSubmit')
        handleSubmit({preventDefault: () => {}})

        wrapper.update()
        isSubmitting = wrapper.prop('isSubmitting')
        expect(isSubmitting).to.be.false

    })

    it("sets isSubmitting while an asychronous submission is processed", (done) => {
        let submitDone
        const wrapper = renderForm({
        }, {
            handleSubmit: () => {
                return new Promise((resolve, reject) => {
                    submitDone = resolve
                })
            },
        })

        let isSubmitting, handleSubmit

        isSubmitting = wrapper.prop('isSubmitting')
        expect(isSubmitting).to.be.false

        handleSubmit = wrapper.prop('handleSubmit')
        handleSubmit({preventDefault: () => {}}).then(() => {

            // This runs after calling submitDone() below
            wrapper.update()
            isSubmitting = wrapper.prop('isSubmitting')
            expect(isSubmitting).to.be.false

            done()

        })

        wrapper.update()
        isSubmitting = wrapper.prop('isSubmitting')
        expect(isSubmitting).to.be.true

        submitDone()
    })

})
