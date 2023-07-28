import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useNotificationContext } from "@app/components/context/Notifications/NotificationProvider";
import NavHeader from "@app/components/navigation/NavHeader";
import {
  Button,
  Input,
  Table,
  TableContainer,
  TableSkeleton,
  TBody,
  Td,
  Th,
  THead,
  Tooltip,
  Tr
} from "@app/components/v2";
import { useOrganization, useWorkspace } from "@app/context";
import {
  useCreateSecretV3,
  useDeleteSecretV3,
  useGetFoldersByEnv,
  useGetProjectSecretsAllEnv,
  useGetUserWsEnvironments,
  useGetUserWsKey,
  useUpdateSecretV3
} from "@app/hooks/api";

import { FolderBreadCrumbs } from "./components/FolderBreadCrumbs";
import { SecretOverviewFolderRow } from "./components/SecretOverviewFolderRow";
import { SecretOverviewTableRow } from "./components/SecretOverviewTableRow";

export const SecretOverviewPage = () => {
  const { t } = useTranslation();
  const { createNotification } = useNotificationContext();
  const router = useRouter();

  // this is to set expandable table width
  // coz when overflow the table goes to the right
  const parentTableRef = useRef<HTMLTableElement>(null);
  const [expandableTableWidth, setExpandableTableWidth] = useState(0);

  useEffect(() => {
    const handleParentTableWidthResize = () => {
      setExpandableTableWidth(parentTableRef.current?.clientWidth || 0);
    };

    window.addEventListener("resize", handleParentTableWidthResize);
    return () => window.removeEventListener("resize", handleParentTableWidthResize);
  }, []);

  useEffect(() => {
    if (parentTableRef.current) {
      setExpandableTableWidth(parentTableRef.current.clientWidth);
    }
  }, [parentTableRef.current]);

  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const { currentOrg } = useOrganization();
  const workspaceId = currentWorkspace?._id as string;
  const { data: latestFileKey } = useGetUserWsKey(workspaceId);
  const [searchFilter, setSearchFilter] = useState("");
  const secretPath = router.query?.secretPath as string;

  useEffect(() => {
    if (!isWorkspaceLoading && !workspaceId && router.isReady) {
      router.push(`/org/${currentOrg?._id}/overview`);
    }
  }, [isWorkspaceLoading, workspaceId, router.isReady]);

  const { data: wsEnv, isLoading: isEnvListLoading } = useGetUserWsEnvironments({
    workspaceId
  });

  const userAvailableEnvs = wsEnv?.filter(({ isReadDenied }) => !isReadDenied) || [];

  const {
    data: secrets,
    getSecretByKey,
    secKeys,
    getEnvSecretKeyCount
  } = useGetProjectSecretsAllEnv({
    workspaceId,
    envs: userAvailableEnvs.map(({ slug }) => slug),
    secretPath,
    decryptFileKey: latestFileKey!
  });
  const { folders, folderNames, isFolderPresentInEnv } = useGetFoldersByEnv({
    workspaceId,
    environments: userAvailableEnvs.map(({ slug }) => slug),
    parentFolderPath: secretPath
  });

  const { mutateAsync: createSecretV3 } = useCreateSecretV3();
  const { mutateAsync: updateSecretV3 } = useUpdateSecretV3();
  const { mutateAsync: deleteSecretV3 } = useDeleteSecretV3();

  const handleSecretCreate = async (env: string, key: string, value: string) => {
    try {
      await createSecretV3({
        environment: env,
        workspaceId,
        secretPath,
        secretName: key,
        secretValue: value,
        secretComment: "",
        type: "shared",
        latestFileKey: latestFileKey!
      });
      createNotification({
        type: "success",
        text: "Successfully created secret"
      });
    } catch (error) {
      console.log(error);
      createNotification({
        type: "error",
        text: "Failed to create secret"
      });
    }
  };

  const handleSecretUpdate = async (env: string, key: string, value: string) => {
    try {
      await updateSecretV3({
        environment: env,
        workspaceId,
        secretPath,
        secretName: key,
        secretValue: value,
        type: "shared",
        latestFileKey: latestFileKey!
      });
      createNotification({
        type: "success",
        text: "Successfully updated secret"
      });
    } catch (error) {
      console.log(error);
      createNotification({
        type: "error",
        text: "Failed to update secret"
      });
    }
  };

  const handleSecretDelete = async (env: string, key: string) => {
    try {
      await deleteSecretV3({
        environment: env,
        workspaceId,
        secretPath,
        secretName: key,
        type: "shared"
      });
      createNotification({
        type: "success",
        text: "Successfully deleted secret"
      });
    } catch (error) {
      console.log(error);
      createNotification({
        type: "error",
        text: "Failed to delete secret"
      });
    }
  };

  const handleResetSearch = () => setSearchFilter("");

  const handleFolderClick = (path: string) => {
    router.push({
      pathname: router.pathname,
      query: {
        ...router.query,
        secretPath: `${router.query?.secretPath || ""}/${path}`
      }
    });
  };

  const handleExploreEnvClick = (slug: string) => {
    const query: Record<string, string> = { ...router.query, env: slug };
    delete query.secretPath;
    // the dir return will have the present directory folder id
    // use that when clicking on explore to redirect user to there
    const envIndex = userAvailableEnvs.findIndex((el) => slug === el.slug);
    if (envIndex !== -1) {
      const envFolder = folders?.[envIndex];
      const dir = envFolder?.data?.dir?.pop();
      if (dir) {
        query.folderId = dir.id;
      }

      router.push({
        pathname: "/project/[id]/secrets/[env]",
        query
      });
    }
  };

  if (isEnvListLoading) {
    return (
      <div className="container mx-auto flex h-screen w-full items-center justify-center px-8 text-mineshaft-50 dark:[color-scheme:dark]">
        <img src="/images/loading/loading.gif" height={70} width={120} alt="loading animation" />
      </div>
    );
  }

  const isTableLoading =
    folders?.some(({ isLoading }) => isLoading) && secrets?.some(({ isLoading }) => isLoading);

  const filteredSecretNames = secKeys?.filter((name) =>
    name.toUpperCase().includes(searchFilter.toUpperCase())
  );
  const filteredFolderNames = folderNames?.filter((name) =>
    name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="container mx-auto px-6 text-mineshaft-50 dark:[color-scheme:dark]">
      <div className="relative right-5 ml-4">
        <NavHeader pageName={t("dashboard.title")} isProjectRelated />
      </div>
      <div className="mt-6">
        <p className="text-3xl font-semibold text-bunker-100">Secrets Overview</p>
        <p className="text-md text-bunker-300">
          Inject your secrets using
          <a
            className="mx-1 text-primary/80 hover:text-primary"
            href="https://infisical.com/docs/cli/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            Infisical CLI
          </a>
          or
          <a
            className="mx-1 text-primary/80 hover:text-primary"
            href="https://infisical.com/docs/sdks/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            Infisical SDKs
          </a>
        </p>
      </div>
      <div className="mt-8 flex items-center justify-between">
        <FolderBreadCrumbs secretPath={secretPath} onResetSearch={handleResetSearch} />
        <div className="w-80">
          <Input
            className="h-[2.3rem] bg-mineshaft-800 placeholder-mineshaft-50 duration-200 focus:bg-mineshaft-700/80"
            placeholder="Search by secret/folder name..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            leftIcon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
          />
        </div>
      </div>
      <div className="thin-scrollbar mt-4 max-h-[calc(100vh-250px)] overflow-y-auto" ref={parentTableRef}>
        <TableContainer className="sticky top-0">
          <Table>
            <THead className="sticky top-0">
              <Tr>
                <Th className="sticky left-0 z-10 min-w-[20rem] bg-clip-padding">Name</Th>
                {userAvailableEnvs?.map(({ name, slug }, index) => {
                  const envSecKeyCount = getEnvSecretKeyCount(slug);
                  const missingKeyCount = secKeys.length - envSecKeyCount;
                  return (
                    <Th
                      className="min-table-row min-w-[11rem] text-center"
                      key={`secret-overview-${name}-${index + 1}`}
                    >
                      <div className="flex items-center justify-center">
                        {name}
                        {missingKeyCount > 0 && (
                          <Tooltip
                            className="max-w-none lowercase"
                            content={`${missingKeyCount} secrets missing\n compared to other environments`}
                          >
                            <div className="ml-2 h-[1.1rem] font-medium flex cursor-default items-center justify-center rounded-sm bg-red-600 border border-red-400 p-1 text-xs text-bunker-100">
                              <span className="text-bunker-100">{missingKeyCount}</span>
                            </div>
                          </Tooltip>
                        )}
                      </div>
                    </Th>
                  );
                })}
              </Tr>
            </THead>
            <TBody>
              {isTableLoading && (
                <TableSkeleton
                  columns={userAvailableEnvs.length + 1}
                  innerKey="secret-overview-loading"
                  rows={5}
                  className="bg-mineshaft-700"
                />
              )}
              {filteredFolderNames.map((folderName, index) => (
                <SecretOverviewFolderRow
                  folderName={folderName}
                  isFolderPresentInEnv={isFolderPresentInEnv}
                  environments={userAvailableEnvs}
                  key={`overview-${folderName}-${index + 1}`}
                  onClick={handleFolderClick}
                />
              ))}
              {filteredSecretNames.map((key, index) => (
                <SecretOverviewTableRow
                  onSecretCreate={handleSecretCreate}
                  onSecretDelete={handleSecretDelete}
                  onSecretUpdate={handleSecretUpdate}
                  key={`overview-${key}-${index + 1}`}
                  environments={userAvailableEnvs}
                  secretKey={key}
                  getSecretByKey={getSecretByKey}
                  expandableColWidth={expandableTableWidth}
                />
              ))}
              <Tr>
                <Td className="fixed left-0 z-10 border-x border-mineshaft-700 bg-mineshaft-800 bg-clip-padding" />
                {userAvailableEnvs.map(({ name, slug }) => (
                  <Td key={`explore-${name}-btn`} className=" border-x border-mineshaft-700">
                    <div className="flex items-center justify-center">
                      <Button
                        size="xs"
                        variant="outline_bg"
                        isFullWidth
                        onClick={() => handleExploreEnvClick(slug)}
                      >
                        Explore
                      </Button>
                    </div>
                  </Td>
                ))}
              </Tr>
            </TBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
};