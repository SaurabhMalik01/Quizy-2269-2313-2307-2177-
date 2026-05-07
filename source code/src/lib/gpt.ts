import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface OutputFormat {
  [key: string]: string | string[] | OutputFormat;
}

export async function strict_output(
  system_prompt: string,
  user_prompt: string | string[],
  output_format: OutputFormat,
  default_category: string = "",
  output_value_only: boolean = false,
  model: string = "gemini-2.5-flash",
  temperature: number = 1,
  num_tries: number = 3,
  verbose: boolean = false
): Promise<
  {
    question: string;
    answer: string;
  }[]
> {
  const list_input: boolean = Array.isArray(user_prompt);
  const dynamic_elements: boolean = /<.*?>/.test(JSON.stringify(output_format));
  const list_output: boolean = /\[.*?\]/.test(JSON.stringify(output_format));

  let error_msg: string = "";

  for (let i = 0; i < num_tries; i++) {
    let output_format_prompt: string = `\nYou are to output the following in JSON format: ${JSON.stringify(
      output_format
    )}. \nDo not put quotation marks or escape character \\ in the output fields.`;

    if (list_output) {
      output_format_prompt += `\nIf output field is a list, classify output into the best element of the list.`;
    }

    if (dynamic_elements) {
      output_format_prompt += `\nAny text enclosed by < and > indicates you must generate content to replace it. Example input: Go to <location>, Example output: Go to the garden\nAny output key containing < and > indicates you must generate the key name to replace it. Example input: {'<location>': 'description of location'}, Example output: {school: a place for education}`;
    }

    if (list_input) {
      output_format_prompt += `\nGenerate a list of JSON objects, one for each input element.`;
    }

    const modelInstance = genAI.getGenerativeModel({
      model: model,
      generationConfig: { temperature },
    });

    let res: string = "";
    try {
      const combinedPrompt = `${system_prompt} ${output_format_prompt} ${error_msg}\n\nUser Query: ${user_prompt.toString()}`;

      if (verbose) {
        console.log("Full prompt:", combinedPrompt);
      }

      const result = await modelInstance.generateContent(combinedPrompt);
      console.log(result);
      const response = await result.response;
      const res = response.text().replace(/'/g, '"'); // Replace single quotes with double quotes

      // Handle Gemini's markdown formatting
      const cleanedRes = res
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const finalRes = cleanedRes.replace(/(\w)"(\w)/g, "$1'$2");

      if (verbose) {
        console.log("\nGemini response:", finalRes);
      }

      let output: any = JSON.parse(finalRes);

      if (list_input) {
        if (!Array.isArray(output)) {
          throw new Error("Output format not in a list of JSON objects");
        }
      } else {
        output = [output];
      }

      for (let index = 0; index < output.length; index++) {
        for (const key in output_format) {
          if (/<.*?>/.test(key)) {
            continue;
          }

          if (!(key in output[index])) {
            throw new Error(`${key} not in JSON output`);
          }

          if (Array.isArray(output_format[key])) {
            const choices = output_format[key] as string[];
            if (Array.isArray(output[index][key])) {
              output[index][key] = output[index][key][0];
            }
            if (!choices.includes(output[index][key]) && default_category) {
              output[index][key] = default_category;
            }
            if (output[index][key].includes(":")) {
              output[index][key] = output[index][key].split(":")[0];
            }
          }
        }

        if (output_value_only) {
          output[index] = Object.values(output[index]);
          if (output[index].length === 1) {
            output[index] = output[index][0];
          }
        }
      }

      return list_input ? output : output[0];
    } catch (e) {
      error_msg = `\n\nError message: ${e}`;
      console.log("An exception occurred:", e);
      if (verbose) {
        console.log("Current invalid JSON format:", res);
      }
    }
  }

  return [];
}
