import { Route, Controller, Get, SuccessResponse, Post, Body, Tags } from "tsoa";
import { BindlePermissionMap } from "./BindleController";

@Route("/api/webhook")
export class HooksController extends Controller {
    @Post("git/sysevent")
    @Tags("System Web Hooks")
    @SuccessResponse(200)
    async processGitSysEventHook(@Body() requestBody: any) {
        console.log(requestBody);
        return "OK"
    }
}