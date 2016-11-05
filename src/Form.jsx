import _ from 'lodash'
import React, { PropTypes } from 'react'

// Display components rendered by a Form will always receive the following
// props from the Form. This definition can be extended to include additional
// props passed via componentProps as needed.

export const FormDisplayPropTypes = {
    // Definition of the form's fields.
    fields: PropTypes.objectOf(
        PropTypes.shape({
            name: PropTypes.string,
            // Field definition
            label: PropTypes.string,
            initial: PropTypes.string,
            readonly: PropTypes.bool,
            required: PropTypes.bool,
            formatter: PropTypes.func,
            validators: PropTypes.arrayOf(
                PropTypes.func.isRequired,
            ),
            choices: PropTypes.arrayOf(
                PropTypes.shape({
                    code: PropTypes.string.isRequired,
                    display: PropTypes.string.isRequired,
                }),
            ),
            // Field state and change
            error: PropTypes.string,                // may be null
            value: PropTypes.string.isRequired,     // may be empty
            onChange: PropTypes.func.isRequired,
        })
    ),
    // Form state and submission
    globalError: PropTypes.string,  // may be null
    isValid: PropTypes.bool.isRequired,
    handleSubmit: PropTypes.func.isRequired,
}

class Form extends React.Component {

    static propTypes = {
        // The display component responsible for rendering the field. The Form
        // component will pass fields, globalError, and isValid properties.
        component: PropTypes.func.isRequired,
        // Allow passing additional props to the child component easily. This
        // can also be achieved with a closure, but it's boilerplate-ish.
        componentProps: PropTypes.object,
        // Definition of the form's fields.
        fields: PropTypes.objectOf(
            PropTypes.shape({
                label: PropTypes.string,
                initial: PropTypes.string,
                readonly: PropTypes.bool,
                required: PropTypes.oneOfType([
                    PropTypes.bool,
                    PropTypes.func,
                ]),
                formatter: PropTypes.func,
                validators: PropTypes.arrayOf(
                    PropTypes.func.isRequired,
                ),
                choices: PropTypes.arrayOf(
                    PropTypes.shape({
                        code: PropTypes.string.isRequired,
                        display: PropTypes.string.isRequired,
                    }),
                ),
            })
        ),
        // Handles submissions.
        handleSubmit: PropTypes.func.isRequired,
    }

    static contextTypes = {
        // If setValues and values aren't provided, values are stored in the
        // component's local state. Both or neither should be provided.
        // Sets field values. Changes must be reflected in values.
        setValues: PropTypes.func,
        // Maps field names to current field values.
        values: PropTypes.object,
    }

    state = {
        clientErrors: {},
        serverErrors: {},
        isSubmitting: false,
        values: {},
    }

    // See https://facebook.github.io/react/blog/2015/12/16/ismounted-antipattern.html

    // There's no way I'm figuring out a promise cancellation library and
    // including 20 lines of boilerplate to work around the removal of the
    // isMounted() API.

    componentWillMount = () => {
        this._isMounted = true
    }

    componentDidMount = () => {
        const values = this.getValues()

        // Run validators when the form mounts.
        const clientErrors = _.mapValues(
            this.getFields(),
            ({name, validators}) => (
                // Run validations only if the field isn't empty -- that's
                // handled by 'required'.
                values[name] === '' ? [] : _.compact(
                    validators.map(validator => validator(values[name], values))
                )
            ),
        )
        this.setState({clientErrors})
    }

    componentWillUnmount = () => {
        this._isMounted = false
    }

    getField = (fieldName, fieldInfo) => {
        if (fieldInfo === undefined) {
            fieldInfo = this.props.fields[fieldName]
        }
        let newFieldInfo = _.assign({
            name: fieldName,
            label: undefined,
            initial: '',
            readonly: false,
            required: true,
            autoComplete: undefined,
            formatter: undefined,
            validators: [],
            choices: undefined,
        }, fieldInfo)

        if (_.isFunction(newFieldInfo.required)) {
            newFieldInfo.required = newFieldInfo.required(this.getValues())
        }

        return newFieldInfo
    }

    getFields = () => {
        return _.mapValues(
            this.props.fields,
            (fieldInfo, fieldName) => this.getField(fieldName, fieldInfo))
    }

    getValue = (fieldName) => {
        const fields = this.props.fields
        const values = this.context.values || this.state.values
        if (values[fieldName] !== undefined) {
            return values[fieldName]
        // We can't use getField here because that causes a loop:
        // getField() depends on getValues() which depends on getValue().
        // We have to duplicate the logic for the default initial value.
        } else if (fields[fieldName].initial !== undefined) {
            return fields[fieldName].initial
        } else {
            return ''
        }
    }

    getValues = () => {
        return _.mapValues(
            this.props.fields,
            (fieldInfo, fieldName) => this.getValue(fieldName))
    }

    setValues = (newValues, callback) => {
        newValues = _.omitBy(
            newValues,
            (value, key) => (this.getField(key).readonly))
        if (this.context.setValues) {
            this.context.setValues(newValues)
        } else {
            var {values} = this.state
            values = _.assign({}, values, newValues)
            this.setState({values}, callback)
        }
    }

    getError = (fieldName) => {
        const clientErrorList = this.state.clientErrors[fieldName] || []
        const serverErrorList = this.state.serverErrors[fieldName || 'all'] || []

        // Server side error are arbitrarily shown after client side errors.
        const errorList = clientErrorList.concat(serverErrorList)
        return errorList.length > 0 ? errorList.join(' ') : null
    }

    setErrorLists = (serverErrors) => {
        this.setState({serverErrors})
    }

    handleChange = (fieldName, value, callback) => {
        const {formatter, validators} = this.getField(fieldName)
        const values = this.getValues()

        if (formatter) {
            value = formatter(value, values[fieldName])
        }

        // Run local validations only for the field that is changing
        // and only if it isn't empty -- that's handled by 'required'.
        // We have no way to tell if errors displayed on other fields or
        // globally are still relevant. In doubt, we leave them alone.
        const errorList = value === '' ? [] : _.compact(
            validators.map(validator => validator(value, values))
        )
        var {clientErrors} = this.state
        clientErrors = _.assign({}, clientErrors, {[fieldName]: errorList})
        this.setState({clientErrors})

        // Set the new value of the controlled input in the state.
        this.setValues({[fieldName]: value}, callback)
    }

    isValid = () => {
        const fields = this.getFields()
        const {clientErrors} = this.state

        // Check if all required fields are provided and pass validation.
        return !_.some(fields, (fieldInfo, fieldName) => (
            (fieldInfo.required && !this.getValue(fieldName)) ||
            ((clientErrors[fieldName] || []).length > 0)
        ))
    }

    startSubmit = () => {
        this.setState({isSubmitting: true})
    }

    endSubmit = () => {
        // It's fine to skip this when the component has unmonted while
        // the promise created in handleSubmit was resolving.
        if (this._isMounted) {
            this.setState({isSubmitting: false})
        }
    }

    handleSubmit = (event) => {
        event.preventDefault()

        const submitDone = this.props.handleSubmit(this.getValues(), this)

        // Only switch the submitting state if the submission is asynchronous.
        if (submitDone !== undefined && _.isFunction(submitDone.then)) {
            // Calling startSubmit after this.props.handleSubmit isn't an
            // issue: React won't re-render until this function has returned.
            this.startSubmit()
            submitDone.then(this.endSubmit)
        }

        return submitDone
    }

    render = () => {
        const {component, componentProps, fields} = this.props
        const {isSubmitting} = this.state
        const formProps = {
            fields: _.mapValues(fields, (fieldInfo, fieldName) => (
                _.assign(
                    this.getField(fieldName, fieldInfo),
                    {
                        error: this.getError(fieldName),
                        value: this.getValue(fieldName),
                        onChange: (event, callback) => {
                            this.handleChange(fieldName, event.target.value, callback)
                        },
                    }
                )
            )),
            globalError: this.getError(),
            isValid: this.isValid(),
            isSubmitting: isSubmitting,
            handleSubmit: this.handleSubmit,
        }
        const props = _.assign({}, componentProps, formProps)
        return React.createElement(component, props)
    }

}

export default Form
