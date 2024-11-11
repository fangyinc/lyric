import { serialize, deserialize } from 'lyric:serialization/msgpack@0.2.0';
import { transpile } from 'lyric:transpiling/typescript-transpile@0.2.0';

function transpileTypeScript(text) {
    try {
        const result = transpile({
            "text": text,
            "target": "cjs",
        })
        console.log(`Transpiled TypeScript code to JavaScript: ${result.text}`);
        return {
            success: true,
            code: result.text
        };
    } catch (error) {
        console.error(`TypeScript transform to JavaScript failed: ${error}`);
        return {
            success: false,
            error: `TypeScript transform to JavaScript failed: ${error.message}`
        };
    }
}

const interpreterTask = {
    run(req) {
        console.log(`[JavaScript-InterpreterTask] script: ${JSON.stringify(req)}`);
        const lang = req.lang;
        let codeString = req.code;

        if (lang.toLowerCase() === 'typescript') {
            console.log("Transpiling TypeScript code to JavaScript");
            const res = transpileTypeScript(codeString);
            if (!res.success) {
                console.log(`Transpiling TypeScript code to JavaScript failed: ${res.error}`);
                return {
                    protocol: 1,
                    data: serialize(new TextEncoder().encode(JSON.stringify({
                        lang: lang,
                        protocol: 1,
                        content: res.error,
                        success: false,
                        exit_code: 1
                    })))
                };
            }
            codeString = res.code;
        }


        let stdout = [];
        let stderr = [];
        let evalResult;
        let success = true;
        let exit_code = 0;

        // Save the original console.log and console.error
        const originalLog = console.log;
        const originalError = console.error;

        // Override console.log and console.error
        console.log = (...args) => {
            stdout.push(args.join(' '));
            originalLog.apply(console, args);
        };
        console.error = (...args) => {
            stderr.push(args.join(' '));
            originalError.apply(console, args);
        };

        try {
            console.log("Begin to run javascript code in interpreter Task");
            // Use the Function constructor to create a new function so that we can capture the return value
            evalResult = new Function(codeString)();
        } catch (error) {
            console.error("Error occurred:", error.message);
            success = false;
            exit_code = 1;
        } finally {
            // Restore the original console.log and console.error
            console.log = originalLog;
            console.error = originalError;
        }

        const result_dict = {
            "lang": "javascript",
            "protocol": 1,
            "content": "Execute script successfully",
            "stdout": stdout.join('\n'),
            "stderr": stderr.join('\n'),
            "success": success,
            "exit_code": exit_code,
            "evalResult": evalResult // Return the result of the eval
        }

        const jsonString = JSON.stringify(result_dict);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonString);
        // Serialize the result with msgpack
        const ser_data = serialize(bytes);

        // const unser_data = deserialize(ser_data);
        // const decoder = new TextDecoder();
        // const result = decoder.decode(unser_data);
        // console.log("Result: ", result);

        return {
            protocol: 1,
            data: ser_data
        };
    },

    run1(req, call_name, input) {
        console.log(`[JavaScript-InterpreterTask] script: ${JSON.stringify(req)}`);
        console.log(`[JavaScript-InterpreterTask] call_name: ${call_name}`);

        const lang = req.lang;
        let codeString = req.code;

        if (lang.toLowerCase() === 'typescript') {
            console.log("Transpiling TypeScript code to JavaScript");
            const res = transpileTypeScript(codeString);
            if (!res.success) {
                console.log(`Transpiling TypeScript code to JavaScript failed: ${res.error}`);
                return {
                    protocol: 1,
                    data: serialize(new TextEncoder().encode(JSON.stringify({
                        lang: lang,
                        protocol: 1,
                        content: res.error,
                        success: false,
                        exit_code: 1
                    }))
                )};
            }
            codeString = res.code;
        }

        let stdout = [];
        let stderr = [];
        let result;
        let success = true;
        let exit_code = 0;

        // Save the original console.log and console.error
        const originalLog = console.log;
        const originalError = console.error;

        // Override console.log and console.error
        console.log = (...args) => {
            stdout.push(args.join(' '));
            originalLog.apply(console, args);
        };
        console.error = (...args) => {
            stderr.push(args.join(' '));
            originalError.apply(console, args);
        };

        try {
            console.log("The code is: ");
            console.log(req.code);

            var user_func;

            const new_code = `
            ${codeString}
            
            if (${call_name} == 'undefined') {
                throw new Error('Function ${call_name} is not defined');
            }
            if (typeof ${call_name} !== 'function') {
                throw new Error('${call_name} is not a function');
            }
            // return ${call_name};
            user_func = ${call_name};
            `
            // Ues eval to execute the code to ensure that the code is executed in the current scope
            eval(new_code)
            const dynamicFunction = user_func;
            // Check if the created object is a function
            if (typeof dynamicFunction !== 'function') {
                throw new Error('The provided string is not a valid function definition');
            }
            console.log(`[JavaScript-InterpreterTask] dynamicFunction: ${dynamicFunction}`);
            // Deserialize the input
            const inputJson = new TextDecoder().decode(deserialize(input));
            const inputData = JSON.parse(inputJson);
            // Execute the function
            result = dynamicFunction(inputData);
        } catch (error) {
            console.error("Error occurred:", error.message);
            result = {
                "error": error.message
            }
            success = false;
            exit_code = 1;
        } finally {
            // Restore the original console.log and console.error
            console.log = originalLog;
            console.error = originalError;
        }

        // Build the return result
        const result_dict = {
            "lang": "javascript",
            "protocol": 1,
            "content": "Execute script successfully",
            "success": success,
            "exit_code": exit_code,
            "stdout": stdout.join('\n'),
            "stderr": stderr.join('\n'),
        }

        const jsonString = JSON.stringify(result_dict);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonString);
        const ser_data = serialize(bytes);

        const outputString = JSON.stringify(result);
        const outputEncoder = new TextEncoder();
        const outputBytes = outputEncoder.encode(outputString);
        const output = serialize(outputBytes);

        return {
            protocol: 1,
            data: ser_data,
            output: output,
        };
    }
};

// An example of a binary task, receives a binary request and returns a binary response
const binaryTask = {
    run(req)  {
        return req;
    }
};

export { binaryTask, interpreterTask };