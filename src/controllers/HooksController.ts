import { Route, Controller, Get, SuccessResponse, Post, Body } from "tsoa";
import { BindlePermissionMap } from "./BindleController";

@Route("/api/webhook")
export class HooksController extends Controller {
    @Post("git/sysevent")
    @SuccessResponse(200)
    async processGitSysEventHook(@Body() requestBody: any) {
        console.log(requestBody);
        return "OK"
    }
}